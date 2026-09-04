import { describe, expect, it, jest } from "@jest/globals";
import {
  base64UrlToUtf8,
  bytesToBase64,
  hexToBytes,
} from "../src/services/bytes";
import { synthesizeSpeech } from "../src/services/cloud-tts";
import {
  buildMiniMaxRequest,
  createMiniMaxSynthesizer,
  groupIdFromKey,
  MINIMAX_AUDIO_SETTING,
  MINIMAX_CN_URL,
  MINIMAX_ENDPOINTS,
  MINIMAX_GLOBAL_URL,
  MINIMAX_MODEL,
  parseMiniMaxResponse,
} from "../src/services/minimax-tts";
import {
  MINIMAX_SEED_VOICES,
  MINIMAX_VOICES,
  minimaxVoiceById,
  minimaxVoiceFor,
} from "../src/services/minimax-voices";
import { createCloudSynthesizer } from "../src/services/tts-provider";
import { resolveTtsCredentials } from "../src/services/tts-config";
import { SEED_VOICES, VOICES, voiceById } from "../src/services/voices";

/**
 * MiniMax as a second cloud voice, beside Doubao Seed-TTS. Maxwell has a
 * MiniMax key (pasted on the phone, never in this repo or in chat): when it
 * is saved, calls, Sync and Listen speak through MiniMax's synchronous T2A
 * HTTP API (`/v1/t2a_v2`, speech-2.8-hd), else through Doubao with the
 * speech-console key, else on device. Everything here runs against a mocked
 * fetch and made-up keys.
 */

const apiKey = "sk-api-test-key-0000";
const female = SEED_VOICES.amanda;
const male = SEED_VOICES.kevin;

type Init = { method: string; headers: Record<string, string>; body: string };
type Body = {
  model: string;
  text: string;
  stream: boolean;
  output_format: string;
  language_boost: string;
  voice_setting: Record<string, unknown>;
  audio_setting: Record<string, unknown>;
};

const okResponse = (audioHex: string, extra: object = {}) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      data: { audio: audioHex, status: 2 },
      extra_info: { audio_length: 1200, audio_format: "mp3" },
      trace_id: "t",
      base_resp: { status_code: 0, status_msg: "success" },
      ...extra,
    }),
});

const errorResponse = (status_code: number, status_msg: string) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      data: null,
      base_resp: { status_code, status_msg },
    }),
});

// A key of the older kind: a JWT whose payload names the group.
const jwtKey = (() => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    GroupName: "Pleasure House",
    GroupID: "1938271645023498240",
    TokenType: 1,
    iss: "minimax",
  })}.signature-not-checked-here`;
})();

describe("bytes", () => {
  it("hex → bytes → base64 agrees with Node for the audio the API returns", () => {
    const bytes = Uint8Array.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x0f, 0xf0]);
    const hex = Buffer.from(bytes).toString("hex");
    expect(hexToBytes(hex)).toEqual(bytes);
    expect(hexToBytes(hex.toUpperCase())).toEqual(bytes);
    expect(bytesToBase64(hexToBytes(hex))).toBe(
      Buffer.from(bytes).toString("base64")
    );
    // Not hex at all: nothing, never a throw.
    expect(hexToBytes("zz")).toEqual(new Uint8Array(0));
    expect(hexToBytes("abc")).toEqual(new Uint8Array(0));
    expect(hexToBytes("")).toEqual(new Uint8Array(0));
  });

  it("decodes a base64url segment to UTF-8 and returns null for garbage", () => {
    const payload = JSON.stringify({ GroupID: "42", 名: "你好" });
    const segment = Buffer.from(payload)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(base64UrlToUtf8(segment)).toBe(payload);
    expect(base64UrlToUtf8("!!!not base64")).toBeNull();
  });
});

describe("MiniMax voices", () => {
  it("every catalogued Doubao voice has a MiniMax voice of the same gender, and every mapped id is a catalogued MiniMax voice", () => {
    VOICES.forEach((voice) => {
      const mapped = minimaxVoiceFor(voice);
      expect(mapped.gender).toBe(voice.gender);
      expect(minimaxVoiceById(mapped.id)).toEqual(mapped);
    });
    const ids = MINIMAX_VOICES.map((voice) => voice.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives Kevin, Chad and Amanda natural Mandarin voices of their gender (no English, no children, no presenters)", () => {
    expect(minimaxVoiceFor(voiceById(SEED_VOICES.kevin)).id).toBe(
      MINIMAX_SEED_VOICES.kevin
    );
    expect(minimaxVoiceFor(voiceById(SEED_VOICES.chad)).id).toBe(
      MINIMAX_SEED_VOICES.chad
    );
    expect(minimaxVoiceFor(voiceById(SEED_VOICES.amanda)).id).toBe(
      MINIMAX_SEED_VOICES.amanda
    );
    expect(minimaxVoiceById(MINIMAX_SEED_VOICES.kevin)?.gender).toBe("male");
    expect(minimaxVoiceById(MINIMAX_SEED_VOICES.chad)?.gender).toBe("male");
    expect(minimaxVoiceById(MINIMAX_SEED_VOICES.amanda)?.gender).toBe("female");
    expect(MINIMAX_SEED_VOICES.kevin).not.toBe(MINIMAX_SEED_VOICES.chad);
    Object.values(MINIMAX_SEED_VOICES).forEach((id) => {
      expect(id).not.toMatch(/English|boy|girl|presenter|audiobook|cartoon/i);
      expect(minimaxVoiceById(id)?.language).toBe("zh");
    });
    // A voice the catalogue does not know still gets a voice, never a throw.
    expect(minimaxVoiceFor(undefined).id).toBe(MINIMAX_SEED_VOICES.kevin);
  });
});

describe("MiniMax T2A request", () => {
  it("posts the synchronous t2a_v2 shape with the key in the Authorization header only", () => {
    const request = buildMiniMaxRequest({
      text: "我在呢。",
      voiceId: female,
      apiKey,
      endpoint: MINIMAX_CN_URL,
    });
    expect(request.url).toBe("https://api.minimaxi.com/v1/t2a_v2");
    expect(request.headers.Authorization).toBe(`Bearer ${apiKey}`);
    expect(request.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(request.body) as Body;
    expect(MINIMAX_MODEL).toBe("speech-2.8-hd");
    expect(body.model).toBe(MINIMAX_MODEL);
    expect(body.text).toBe("我在呢。");
    expect(body.stream).toBe(false);
    expect(body.output_format).toBe("hex");
    expect(body.language_boost).toBe("auto");
    expect(body.voice_setting).toEqual({
      voice_id: MINIMAX_SEED_VOICES.amanda,
      speed: 1,
      vol: 1,
      pitch: 0,
    });
    // `emotion: "auto"` is documented but refused by the API; the model picks
    // the emotion on its own when the field is absent.
    expect(body.voice_setting.emotion).toBeUndefined();
    expect(body.audio_setting).toEqual(MINIMAX_AUDIO_SETTING);
    expect(MINIMAX_AUDIO_SETTING).toEqual({
      sample_rate: 24000,
      bitrate: 64000,
      format: "mp3",
      channel: 1,
    });
    // The secret travels in the header and nowhere else.
    expect(request.body).not.toContain(apiKey);
    expect(request.url).not.toContain(apiKey);
  });

  it("speaks each person in their own MiniMax voice", () => {
    const voiceOf = (voiceId: string) =>
      (
        JSON.parse(
          buildMiniMaxRequest({
            text: "hi",
            voiceId,
            apiKey,
            endpoint: MINIMAX_CN_URL,
          }).body
        ) as Body
      ).voice_setting.voice_id;
    expect(voiceOf(SEED_VOICES.kevin)).toBe(MINIMAX_SEED_VOICES.kevin);
    expect(voiceOf(SEED_VOICES.chad)).toBe(MINIMAX_SEED_VOICES.chad);
    expect(voiceOf(SEED_VOICES.amanda)).toBe(MINIMAX_SEED_VOICES.amanda);
  });

  it("an older JWT key carries its GroupID, which the endpoint wants as a query parameter; a new sk-api key does not", () => {
    expect(groupIdFromKey(jwtKey)).toBe("1938271645023498240");
    expect(groupIdFromKey(apiKey)).toBeNull();
    expect(groupIdFromKey("a.b")).toBeNull();
    expect(groupIdFromKey("")).toBeNull();
    const withGroup = buildMiniMaxRequest({
      text: "hi",
      voiceId: male,
      apiKey: jwtKey,
      endpoint: MINIMAX_GLOBAL_URL,
    });
    expect(withGroup.url).toBe(
      "https://api.minimax.io/v1/t2a_v2?GroupId=1938271645023498240"
    );
    expect(withGroup.url).not.toContain(jwtKey);
    const without = buildMiniMaxRequest({
      text: "hi",
      voiceId: male,
      apiKey,
      endpoint: MINIMAX_GLOBAL_URL,
    });
    expect(without.url).toBe("https://api.minimax.io/v1/t2a_v2");
  });
});

describe("MiniMax T2A response", () => {
  it("turns the hex audio into one base64 chunk for the native player", () => {
    const bytes = Uint8Array.from([0xff, 0xfb, 0x90, 0x64, 0x00]);
    const hex = Buffer.from(bytes).toString("hex");
    const parsed = parseMiniMaxResponse(
      JSON.stringify({
        data: { audio: hex, status: 2 },
        base_resp: { status_code: 0, status_msg: "success" },
      })
    );
    expect(parsed).toEqual({
      ok: true,
      chunk: Buffer.from(bytes).toString("base64"),
    });
  });

  it("maps the service's codes: key problems stop the session, voice problems fall back for that voice, the rest is transient", () => {
    const reasonOf = (code: number, msg: string) => {
      const parsed = parseMiniMaxResponse(
        JSON.stringify({
          data: null,
          base_resp: { status_code: code, status_msg: msg },
        })
      );
      return parsed.ok ? "ok" : parsed.reason;
    };
    expect(reasonOf(1004, "not authorized")).toBe("auth");
    expect(reasonOf(2049, "invalid API Key")).toBe("auth");
    // No balance: nothing will play this session either; stop asking.
    expect(reasonOf(1008, "insufficient balance")).toBe("auth");
    expect(reasonOf(20132, "invalid samples or voice_id")).toBe("voice");
    expect(reasonOf(2042, "You don't have access to this voice_id")).toBe(
      "voice"
    );
    expect(reasonOf(1002, "rate limit")).toBe("request_failed");
    expect(reasonOf(1000, "unknown error")).toBe("request_failed");
    expect(reasonOf(2013, "invalid params")).toBe("request_failed");
    const parsed = parseMiniMaxResponse(
      JSON.stringify({
        data: null,
        base_resp: { status_code: 1004, status_msg: "not authorized" },
      })
    );
    expect(parsed).toMatchObject({
      ok: false,
      message: "not authorized",
      code: 1004,
    });
  });

  it("an empty or unreadable body is a transient failure, not silence played as audio", () => {
    expect(parseMiniMaxResponse("")).toMatchObject({
      ok: false,
      reason: "request_failed",
    });
    expect(parseMiniMaxResponse("<html>bad gateway</html>")).toMatchObject({
      ok: false,
      reason: "request_failed",
    });
    expect(
      parseMiniMaxResponse(
        JSON.stringify({
          data: { audio: "", status: 2 },
          base_resp: { status_code: 0 },
        })
      )
    ).toMatchObject({ ok: false, reason: "request_failed" });
    expect(
      parseMiniMaxResponse(
        JSON.stringify({
          data: { audio: "not-hex", status: 2 },
          base_resp: { status_code: 0 },
        })
      )
    ).toMatchObject({ ok: false, reason: "request_failed" });
  });
});

describe("MiniMax synthesizer", () => {
  const credentials = { kind: "minimax", apiKey } as const;
  const hex = "fffb9064";
  const chunk = Buffer.from(hex, "hex").toString("base64");

  it("tries the China platform first (Maxwell's other vendors are there) and returns the audio", async () => {
    const fetchImpl = jest.fn(async () =>
      okResponse(hex)
    ) as unknown as typeof fetch;
    const synthesize = createMiniMaxSynthesizer({ fetchImpl });
    const result = await synthesize({
      text: "你好",
      voiceId: female,
      credentials,
    });
    expect(result).toEqual({ ok: true, chunks: [chunk] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0] as [
      string,
      Init
    ];
    expect(MINIMAX_ENDPOINTS).toEqual([MINIMAX_CN_URL, MINIMAX_GLOBAL_URL]);
    expect(url).toBe(MINIMAX_CN_URL);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${apiKey}`);
  });

  it("a key the China platform refuses is tried on the global platform, and the platform that took it is remembered for the session", async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      url === MINIMAX_CN_URL
        ? errorResponse(1004, "not authorized")
        : okResponse(hex)
    ) as unknown as typeof fetch;
    const synthesize = createMiniMaxSynthesizer({ fetchImpl });
    expect(
      await synthesize({ text: "hi", voiceId: male, credentials })
    ).toEqual({
      ok: true,
      chunks: [chunk],
    });
    expect((fetchImpl as jest.Mock).mock.calls.map((call) => call[0])).toEqual([
      MINIMAX_CN_URL,
      MINIMAX_GLOBAL_URL,
    ]);
    (fetchImpl as jest.Mock).mockClear();
    expect(
      await synthesize({ text: "again", voiceId: male, credentials })
    ).toEqual({
      ok: true,
      chunks: [chunk],
    });
    expect((fetchImpl as jest.Mock).mock.calls.map((call) => call[0])).toEqual([
      MINIMAX_GLOBAL_URL,
    ]);
  });

  it("a key both platforms refuse is an auth failure (the engine stops asking this session); HTTP 401 counts as a refusal too", async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      url === MINIMAX_CN_URL
        ? { ok: false, status: 401, text: async () => "unauthorized" }
        : errorResponse(2049, "invalid API Key")
    ) as unknown as typeof fetch;
    const synthesize = createMiniMaxSynthesizer({ fetchImpl });
    expect(
      await synthesize({ text: "hi", voiceId: male, credentials })
    ).toMatchObject({
      ok: false,
      reason: "auth",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("a platform that cannot be reached is skipped for the other; when neither can, the failure is transient", async () => {
    const reachable = jest.fn(async (url: string) => {
      if (url === MINIMAX_CN_URL) {
        throw new Error("Network request failed");
      }
      return okResponse(hex);
    }) as unknown as typeof fetch;
    expect(
      await createMiniMaxSynthesizer({ fetchImpl: reachable })({
        text: "hi",
        voiceId: male,
        credentials,
      })
    ).toEqual({ ok: true, chunks: [chunk] });

    const offline = jest.fn(async () => {
      throw new Error("Network request failed");
    }) as unknown as typeof fetch;
    expect(
      await createMiniMaxSynthesizer({ fetchImpl: offline })({
        text: "hi",
        voiceId: male,
        credentials,
      })
    ).toMatchObject({ ok: false, reason: "request_failed" });
  });

  it("a voice the account cannot use, or a transient error, is reported as such without trying the other platform", async () => {
    const denied = jest.fn(async () =>
      errorResponse(2042, "You don't have access to this voice_id")
    ) as unknown as typeof fetch;
    expect(
      await createMiniMaxSynthesizer({ fetchImpl: denied })({
        text: "hi",
        voiceId: male,
        credentials,
      })
    ).toMatchObject({ ok: false, reason: "voice" });
    expect(denied).toHaveBeenCalledTimes(1);

    const limited = jest.fn(async () =>
      errorResponse(1002, "rate limit")
    ) as unknown as typeof fetch;
    expect(
      await createMiniMaxSynthesizer({ fetchImpl: limited })({
        text: "hi",
        voiceId: male,
        credentials,
      })
    ).toMatchObject({ ok: false, reason: "request_failed" });
    expect(limited).toHaveBeenCalledTimes(1);
  });

  it("passes the abort signal through so a stop cancels the request", async () => {
    const fetchImpl = jest.fn(async () =>
      okResponse(hex)
    ) as unknown as typeof fetch;
    const controller = new AbortController();
    await createMiniMaxSynthesizer({ fetchImpl })({
      text: "hi",
      voiceId: male,
      credentials,
      signal: controller.signal,
    });
    const [, init] = (fetchImpl as jest.Mock).mock.calls[0] as [
      string,
      { signal?: AbortSignal }
    ];
    expect(init.signal).toBe(controller.signal);
  });
});

describe("cloud provider", () => {
  it("routes by the credentials: a MiniMax key to MiniMax, a Doubao key to Doubao — one engine, two clouds", async () => {
    const calls: string[] = [];
    const fetchImpl = jest.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("minimax")) {
        return okResponse("fffb");
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          '{"code":0,"message":"","data":"AAAA"}{"code":20000000,"message":"ok","data":null}',
      };
    }) as unknown as typeof fetch;
    const synthesize = createCloudSynthesizer({ fetchImpl });
    const signal = new AbortController().signal;

    expect(
      await synthesize({
        text: "hi",
        voiceId: male,
        credentials: { kind: "minimax", apiKey },
        signal,
      })
    ).toEqual({
      ok: true,
      chunks: [Buffer.from("fffb", "hex").toString("base64")],
    });
    expect(
      await synthesize({
        text: "hi",
        voiceId: male,
        credentials: { kind: "api-key", apiKey: "speech", source: "tts" },
        signal,
        expressive: true,
      })
    ).toEqual({ ok: true, chunks: ["AAAA"] });
    expect(calls).toEqual([
      MINIMAX_CN_URL,
      "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
    ]);
    // The Doubao path is the one that was already there.
    expect(typeof synthesizeSpeech).toBe("function");
  });
});

describe("credentials", () => {
  it("a MiniMax key wins over the Doubao speech key, which wins over the legacy app pair and the Ark best effort", () => {
    expect(
      resolveTtsCredentials({
        minimaxApiKey: "  mm  ",
        ttsApiKey: "speech",
        ttsAppId: "1",
        ttsAccessToken: "t",
        arkApiKey: "ark",
      })
    ).toEqual({ kind: "minimax", apiKey: "mm" });
    expect(
      resolveTtsCredentials({ minimaxApiKey: "   ", ttsApiKey: "speech" })
    ).toEqual({ kind: "api-key", apiKey: "speech", source: "tts" });
    expect(resolveTtsCredentials({ minimaxApiKey: "mm" })).toEqual({
      kind: "minimax",
      apiKey: "mm",
    });
  });
});
