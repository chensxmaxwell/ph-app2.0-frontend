import type { TtsCredentials } from "./tts-config";

/**
 * Doubao Seed-TTS (火山引擎 豆包语音合成大模型) over the V3 HTTP endpoint:
 * one POST with the whole text, a chunked body of concatenated JSON objects
 * whose `data` fields are base64 MP3 pieces, closed by code 20000000.
 * https://www.volcengine.com/docs/6561/1598757
 */
export const DOUBAO_TTS_URL =
  "https://openspeech.bytedance.com/api/v3/tts/unidirectional";

// Anything the caller can tell about us; the endpoint wants a non-empty uid.
const APP_UID = "pleasure-house";
// Seed-TTS wants short texts (the 1.0 doc says ≤ 1024 bytes, best < 300
// chars); replies are split into sentence runs under this many characters.
export const MAX_SYNTHESIS_CHARS = 220;
export const SYNTHESIS_TIMEOUT_MS = 8000;

// The resource a speaker bills under: 2.0 speakers (`*_uranus_bigtts`,
// `saturn_*`) are seed-tts-2.0, everything older is seed-tts-1.0.
export const resourceIdForVoice = (voiceId: string) =>
  voiceId.endsWith("_uranus_bigtts") || voiceId.startsWith("saturn_")
    ? "seed-tts-2.0"
    : "seed-tts-1.0";

export type TtsRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

export const buildTtsRequest = ({
  text,
  voiceId,
  credentials,
  requestId,
}: {
  text: string;
  voiceId: string;
  credentials: TtsCredentials;
  requestId: string;
}): TtsRequest => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Resource-Id": resourceIdForVoice(voiceId),
    "X-Api-Request-Id": requestId,
  };
  switch (credentials.kind) {
    case "api-key":
      headers["X-Api-Key"] = credentials.apiKey;
      break;
    case "app":
      headers["X-Api-App-Id"] = credentials.appId;
      headers["X-Api-Access-Key"] = credentials.accessToken;
      break;
    default: {
      const exhaustive: never = credentials;
      return exhaustive;
    }
  }
  return {
    url: DOUBAO_TTS_URL,
    headers,
    body: JSON.stringify({
      user: { uid: APP_UID },
      req_params: {
        text,
        speaker: voiceId,
        audio_params: { format: "mp3", sample_rate: 24000 },
      },
    }),
  };
};

// Sentence runs of at most MAX_SYNTHESIS_CHARS, in order, nothing dropped.
export const splitForSynthesis = (text: string): string[] => {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.length <= MAX_SYNTHESIS_CHARS) {
    return [trimmed];
  }
  const sentences = trimmed.match(/[^。！？!?.;；\n]+[。！？!?.;；\n]*|\s+/g) ?? [
    trimmed,
  ];
  const parts: string[] = [];
  let current = "";
  sentences.forEach((sentence) => {
    let piece = sentence;
    while (piece.length > MAX_SYNTHESIS_CHARS) {
      if (current) {
        parts.push(current);
        current = "";
      }
      parts.push(piece.slice(0, MAX_SYNTHESIS_CHARS));
      piece = piece.slice(MAX_SYNTHESIS_CHARS);
    }
    if (current.length + piece.length > MAX_SYNTHESIS_CHARS) {
      parts.push(current);
      current = piece;
    } else {
      current += piece;
    }
  });
  if (current) {
    parts.push(current);
  }
  return parts;
};

export type TtsStreamResult = {
  ok: boolean;
  chunks: string[];
  code: number | null;
  message: string;
};

const TTS_DONE_CODE = 20000000;

type TtsFrame = { code?: number; message?: string; data?: string | null };

// Top-level JSON objects out of a body that is either concatenated objects
// (HTTP chunked) or SSE `data: {...}` lines; strings and escapes respected.
const jsonObjects = (raw: string): TtsFrame[] => {
  const frames: TtsFrame[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = depth > 0;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          frames.push(JSON.parse(raw.slice(start, index + 1)) as TtsFrame);
        } catch {
          // Not a frame; keep scanning.
        }
        start = -1;
      }
    }
  }
  return frames;
};

export const parseTtsStream = (raw: string): TtsStreamResult => {
  const frames = jsonObjects(raw);
  const chunks: string[] = [];
  let code: number | null = null;
  let message = "";
  for (const frame of frames) {
    if (typeof frame.code === "number") {
      if (frame.code !== 0) {
        code = frame.code;
        message = typeof frame.message === "string" ? frame.message : "";
      }
      if (frame.code !== 0 && frame.code !== TTS_DONE_CODE) {
        return { ok: false, chunks: [], code, message };
      }
    }
    if (typeof frame.data === "string" && frame.data.length > 0) {
      chunks.push(frame.data);
    }
  }
  if (frames.length === 0 || chunks.length === 0) {
    return {
      ok: false,
      chunks: [],
      code,
      message: message || "No audio in the response.",
    };
  }
  return { ok: true, chunks, code, message };
};

export type SynthesisFailure = {
  ok: false;
  // auth: the credentials were refused (stop asking this session).
  // voice: this speaker is not enabled on the account (fall back for it).
  // request_failed: network / server trouble / empty body (try again later).
  reason: "auth" | "voice" | "request_failed";
  message: string;
  status?: number;
};

export type SynthesisResult = { ok: true; chunks: string[] } | SynthesisFailure;

const requestId = () =>
  `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

const VOICE_DENIED_CODE = 45000000;

export const synthesizeSpeech = async ({
  text,
  voiceId,
  credentials,
  signal,
  fetchImpl = fetch,
}: {
  text: string;
  voiceId: string;
  credentials: TtsCredentials;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<SynthesisResult> => {
  const request = buildTtsRequest({
    text,
    voiceId,
    credentials,
    requestId: requestId(),
  });
  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      signal,
    });
  } catch (error) {
    return {
      ok: false,
      reason: "request_failed",
      message: error instanceof Error ? error.message : "Network request failed",
    };
  }
  if (!response.ok) {
    await response.text().catch(() => "");
    return {
      ok: false,
      reason:
        response.status === 401 || response.status === 403
          ? "auth"
          : "request_failed",
      message: `HTTP ${response.status}`,
      status: response.status,
    };
  }
  const raw = await response.text().catch(() => "");
  const parsed = parseTtsStream(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: parsed.code === VOICE_DENIED_CODE ? "voice" : "request_failed",
      message: parsed.message,
    };
  }
  return { ok: true, chunks: parsed.chunks };
};
