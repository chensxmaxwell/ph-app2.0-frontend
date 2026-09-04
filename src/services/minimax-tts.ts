import { base64UrlToUtf8, bytesToBase64, hexToBytes } from "./bytes";
import type { SynthesisFailure, SynthesisResult, TtsRequest } from "./cloud-tts";
import { minimaxVoiceFor } from "./minimax-voices";
import { voiceById } from "./voices";

/**
 * MiniMax speech (T2A v2, synchronous HTTP): one POST with the whole text,
 * the audio back as hex inside a JSON envelope.
 * https://platform.minimax.io/docs/api-reference/speech-t2a-http
 * https://platform.minimaxi.com/docs/api-reference/speech-t2a-http
 *
 * MiniMax runs two platforms with separate accounts and keys — China
 * (platform.minimaxi.com → api.minimaxi.com) and global (platform.minimax.io
 * → api.minimax.io). Which console issued the saved key is not something the
 * app can know, so a key one platform refuses is tried on the other, and the
 * platform that accepts it is remembered for the session. Maxwell's other
 * vendors are Chinese, so China goes first.
 *
 * The key travels in the Authorization header and nowhere else, and is
 * never logged. Older MiniMax keys are JWTs whose payload names the account
 * group; that endpoint wants the GroupId as a query parameter, so it is
 * read from the key itself. New `sk-api-…` keys need nothing.
 */
export const MINIMAX_MODEL = "speech-2.8-hd";
export const MINIMAX_CN_URL = "https://api.minimaxi.com/v1/t2a_v2";
export const MINIMAX_GLOBAL_URL = "https://api.minimax.io/v1/t2a_v2";
export const MINIMAX_ENDPOINTS: readonly string[] = [
  MINIMAX_CN_URL,
  MINIMAX_GLOBAL_URL,
];
// Voice quality at half the bytes of the 32 kHz / 128 kbps default; the
// hex-in-JSON body is decoded and re-encoded on the JS thread.
export const MINIMAX_AUDIO_SETTING = {
  sample_rate: 24000,
  bitrate: 64000,
  format: "mp3",
  channel: 1,
} as const;

export type MiniMaxCredentials = { kind: "minimax"; apiKey: string };

// Codes that mean the key (or the account behind it) will not work this
// session, the codes that mean this voice will not, and everything else.
const AUTH_CODES = new Set([1004, 2049]);
const BALANCE_CODE = 1008;
const VOICE_CODES = new Set([20132, 2042]);

// The account group inside an older JWT key, or null for a new-style key.
export const groupIdFromKey = (apiKey: string): string | null => {
  const parts = apiKey.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const payload = base64UrlToUtf8(parts[1]);
  if (payload === null) {
    return null;
  }
  try {
    const claims = JSON.parse(payload) as { GroupID?: unknown };
    return typeof claims.GroupID === "string" && claims.GroupID.length > 0
      ? claims.GroupID
      : null;
  } catch {
    return null;
  }
};

export const buildMiniMaxRequest = ({
  text,
  voiceId,
  apiKey,
  endpoint,
}: {
  text: string;
  voiceId: string;
  apiKey: string;
  endpoint: string;
}): TtsRequest => {
  const groupId = groupIdFromKey(apiKey);
  return {
    url: groupId
      ? `${endpoint}?GroupId=${encodeURIComponent(groupId)}`
      : endpoint,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      text,
      stream: false,
      output_format: "hex",
      language_boost: "auto",
      // No `emotion`: absent, the model reads it from the text ("auto" is
      // documented and refused).
      voice_setting: {
        voice_id: minimaxVoiceFor(voiceById(voiceId)).id,
        speed: 1,
        vol: 1,
        pitch: 0,
      },
      audio_setting: MINIMAX_AUDIO_SETTING,
    }),
  };
};

type MiniMaxFailure = SynthesisFailure & { code: number | null };

export type MiniMaxParse = { ok: true; chunk: string } | MiniMaxFailure;

type Envelope = {
  data?: { audio?: unknown; status?: unknown } | null;
  base_resp?: { status_code?: unknown; status_msg?: unknown };
};

const transient = (message: string, code: number | null): MiniMaxFailure => ({
  ok: false,
  reason: "request_failed",
  message,
  code,
});

// The JSON envelope → one base64 chunk for the native player, or why not.
export const parseMiniMaxResponse = (raw: string): MiniMaxParse => {
  let envelope: Envelope;
  try {
    envelope = JSON.parse(raw) as Envelope;
  } catch {
    return transient("No audio in the response.", null);
  }
  if (!envelope || typeof envelope !== "object") {
    return transient("No audio in the response.", null);
  }
  const status = envelope.base_resp?.status_code;
  const code = typeof status === "number" ? status : null;
  const message =
    typeof envelope.base_resp?.status_msg === "string"
      ? envelope.base_resp.status_msg
      : "";
  if (code !== null && code !== 0) {
    if (AUTH_CODES.has(code) || code === BALANCE_CODE) {
      return { ok: false, reason: "auth", message, code };
    }
    if (VOICE_CODES.has(code)) {
      return { ok: false, reason: "voice", message, code };
    }
    return transient(message || `MiniMax error ${code}`, code);
  }
  const audio = envelope.data?.audio;
  const bytes = typeof audio === "string" ? hexToBytes(audio) : new Uint8Array(0);
  if (bytes.length === 0) {
    return transient("No audio in the response.", code);
  }
  return { ok: true, chunk: bytesToBase64(bytes) };
};

export type MiniMaxSynthesizeInput = {
  text: string;
  voiceId: string;
  credentials: MiniMaxCredentials;
  signal?: AbortSignal;
};

// One synthesizer per session: it remembers which platform took the key.
export const createMiniMaxSynthesizer = ({
  fetchImpl = fetch,
  endpoints = MINIMAX_ENDPOINTS,
}: { fetchImpl?: typeof fetch; endpoints?: readonly string[] } = {}) => {
  let preferred: string | null = null;

  const attempt = async (
    endpoint: string,
    input: MiniMaxSynthesizeInput
  ): Promise<MiniMaxParse> => {
    const request = buildMiniMaxRequest({
      text: input.text,
      voiceId: input.voiceId,
      apiKey: input.credentials.apiKey,
      endpoint,
    });
    let response: Response;
    try {
      response = await fetchImpl(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: input.signal,
      });
    } catch (error) {
      return transient(
        error instanceof Error ? error.message : "Network request failed",
        null
      );
    }
    if (!response.ok) {
      await response.text().catch(() => "");
      const refused = response.status === 401 || response.status === 403;
      return {
        ok: false,
        reason: refused ? "auth" : "request_failed",
        message: `HTTP ${response.status}`,
        status: response.status,
        code: null,
      };
    }
    return parseMiniMaxResponse(await response.text().catch(() => ""));
  };

  return async (input: MiniMaxSynthesizeInput): Promise<SynthesisResult> => {
    const order = preferred
      ? [preferred, ...endpoints.filter((endpoint) => endpoint !== preferred)]
      : [...endpoints];
    let last: MiniMaxFailure | null = null;
    for (const endpoint of order) {
      const result = await attempt(endpoint, input);
      if (result.ok) {
        preferred = endpoint;
        return { ok: true, chunks: [result.chunk] };
      }
      last = result;
      // Only "this platform will not take this key" and "this platform
      // cannot be reached" are reasons to knock on the other door.
      if (result.reason === "voice") {
        break;
      }
      if (result.reason === "request_failed" && result.code !== null) {
        break;
      }
    }
    const failure = last ?? transient("No audio in the response.", null);
    return {
      ok: false,
      reason: failure.reason,
      message: failure.message,
      ...(failure.status !== undefined ? { status: failure.status } : {}),
    };
  };
};
