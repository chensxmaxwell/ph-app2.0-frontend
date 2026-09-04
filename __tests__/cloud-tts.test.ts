import { describe, expect, it, jest } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";
import {
  DOUBAO_TTS_URL,
  MAX_SYNTHESIS_CHARS,
  buildTtsRequest,
  parseTtsStream,
  resourceIdForVoice,
  splitForSynthesis,
  synthesizeSpeech,
} from "../src/services/cloud-tts";
import { resolveTtsCredentials } from "../src/services/tts-config";
import { createSpeechEngine } from "../src/services/speech-engine";
import { FEMALE_VOICES, MALE_VOICES, SEED_VOICES } from "../src/services/voices";

/**
 * The companion's voice comes from Doubao Seed-TTS 2.0 (火山引擎 豆包语音合成
 * 模型 2.0) over the V3 HTTP endpoint, played through PHNative; when the
 * cloud is not reachable the reply still speaks, in an on-device voice of
 * the same gender, never the system default.
 */

const female = FEMALE_VOICES[0].id;
const male = MALE_VOICES[0].id;

describe("Doubao TTS request", () => {
  it("targets the V3 unidirectional endpoint with the new-console API key and the 2.0 resource", () => {
    const request = buildTtsRequest({
      text: "你好",
      voiceId: female,
      credentials: { kind: "api-key", apiKey: "speech-key", source: "tts" },
      requestId: "req-1",
    });
    expect(request.url).toBe(DOUBAO_TTS_URL);
    expect(request.url).toBe(
      "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    );
    expect(request.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Api-Key": "speech-key",
      "X-Api-Resource-Id": "seed-tts-2.0",
      "X-Api-Request-Id": "req-1",
    });
    expect(request.headers["X-Api-App-Id"]).toBeUndefined();
    const body = JSON.parse(request.body) as {
      user: { uid: string };
      req_params: {
        text: string;
        speaker: string;
        audio_params: { format: string; sample_rate: number };
      };
    };
    expect(body.user.uid.length).toBeGreaterThan(0);
    expect(body.req_params.text).toBe("你好");
    expect(body.req_params.speaker).toBe(female);
    expect(body.req_params.audio_params).toEqual({
      format: "mp3",
      sample_rate: 24000,
    });
  });

  it("uses the legacy app id + access token headers when that is what the account has", () => {
    const request = buildTtsRequest({
      text: "hi",
      voiceId: male,
      credentials: { kind: "app", appId: "123", accessToken: "tok" },
      requestId: "req-2",
    });
    expect(request.headers["X-Api-App-Id"]).toBe("123");
    expect(request.headers["X-Api-Access-Key"]).toBe("tok");
    expect(request.headers["X-Api-Key"]).toBeUndefined();
  });

  it("bills 2.0 speakers under seed-tts-2.0 and 1.0 speakers under seed-tts-1.0", () => {
    expect(resourceIdForVoice("zh_female_xiaohe_uranus_bigtts")).toBe("seed-tts-2.0");
    expect(resourceIdForVoice("saturn_abc")).toBe("seed-tts-2.0");
    expect(resourceIdForVoice("zh_female_shuangkuaisisi_moon_bigtts")).toBe(
      "seed-tts-1.0"
    );
    expect(resourceIdForVoice("zh_male_ahu_conversation_wvae_bigtts")).toBe(
      "seed-tts-1.0"
    );
  });

  it("splits a long reply into sentence runs the endpoint accepts and keeps a short one whole", () => {
    expect(splitForSynthesis("我在呢。")).toEqual(["我在呢。"]);
    const long = Array.from(
      { length: 40 },
      (_, i) => `第${i}句话，说得很长很长。`
    ).join("");
    expect(long.length).toBeGreaterThan(MAX_SYNTHESIS_CHARS);
    const parts = splitForSynthesis(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(long);
    parts.forEach((part) => {
      expect(part.length).toBeLessThanOrEqual(MAX_SYNTHESIS_CHARS);
      expect(part.endsWith("。")).toBe(true);
    });
    expect(splitForSynthesis("   ")).toEqual([]);
  });
});

describe("Doubao TTS response", () => {
  it("collects the base64 audio from the chunked stream of concatenated JSON objects", () => {
    const raw =
      '{"code":0,"message":"","data":"AAAA"}' +
      '{"code":0,"message":"","data":null,"sentence":{"text":"a}b","words":[]}}' +
      '{"code":0,"message":"","data":"BBBB"}' +
      '{"code":20000000,"message":"ok","data":null}';
    expect(parseTtsStream(raw)).toEqual({
      ok: true,
      chunks: ["AAAA", "BBBB"],
      code: 20000000,
      message: "ok",
    });
  });

  it("reads the SSE variant too", () => {
    const raw =
      'data: {"code":0,"message":"","data":"AAAA"}\n\n' +
      'data: {"code":0,"message":"","data":null,"sentence":{"text":"x"}}\n\n' +
      'data: {"code":20000000,"message":"OK","data":null,"usage":{"text_words":3}}\n\n';
    expect(parseTtsStream(raw)).toMatchObject({ ok: true, chunks: ["AAAA"] });
  });

  it("surfaces the service's error code instead of pretending silence is audio", () => {
    const raw =
      '{"code":45000000,"message":"speaker permission denied: get resource id: access denied","data":null}';
    expect(parseTtsStream(raw)).toEqual({
      ok: false,
      chunks: [],
      code: 45000000,
      message: "speaker permission denied: get resource id: access denied",
    });
    expect(parseTtsStream("")).toMatchObject({ ok: false, chunks: [] });
    expect(parseTtsStream("<html>nope</html>")).toMatchObject({ ok: false });
  });
});

describe("synthesizeSpeech", () => {
  const credentials = {
    kind: "api-key",
    apiKey: "speech-key",
    source: "tts",
  } as const;

  it("returns the audio chunks on success", async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '{"code":0,"message":"","data":"AAAA"}{"code":20000000,"message":"ok","data":null}',
    })) as unknown as typeof fetch;
    const result = await synthesizeSpeech({
      text: "你好",
      voiceId: female,
      credentials,
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, chunks: ["AAAA"] });
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string> }
    ];
    expect(url).toBe(DOUBAO_TTS_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["X-Api-Key"]).toBe("speech-key");
  });

  it("reports a refused key as an auth failure and a bad speaker as a voice failure", async () => {
    const refused = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    })) as unknown as typeof fetch;
    expect(
      await synthesizeSpeech({ text: "hi", voiceId: male, credentials, fetchImpl: refused })
    ).toMatchObject({ ok: false, reason: "auth", status: 401 });

    const denied = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '{"code":45000000,"message":"speaker permission denied","data":null}',
    })) as unknown as typeof fetch;
    expect(
      await synthesizeSpeech({ text: "hi", voiceId: male, credentials, fetchImpl: denied })
    ).toMatchObject({ ok: false, reason: "voice" });

    const offline = jest.fn(async () => {
      throw new Error("Network request failed");
    }) as unknown as typeof fetch;
    expect(
      await synthesizeSpeech({ text: "hi", voiceId: male, credentials, fetchImpl: offline })
    ).toMatchObject({ ok: false, reason: "request_failed" });
  });
});

describe("credentials", () => {
  it("prefers a speech-console key, then legacy app credentials, then tries the Ark key, else none", () => {
    expect(
      resolveTtsCredentials({
        ttsApiKey: "speech",
        ttsAppId: "1",
        ttsAccessToken: "t",
        arkApiKey: "ark",
      })
    ).toEqual({ kind: "api-key", apiKey: "speech", source: "tts" });
    expect(
      resolveTtsCredentials({ ttsAppId: "1", ttsAccessToken: "t", arkApiKey: "ark" })
    ).toEqual({ kind: "app", appId: "1", accessToken: "t" });
    // The Ark key is the same vendor; the speech console issues its own key,
    // so this is a best effort the engine drops after one refusal.
    expect(resolveTtsCredentials({ arkApiKey: "ark" })).toEqual({
      kind: "api-key",
      apiKey: "ark",
      source: "ark",
    });
    expect(resolveTtsCredentials({ ttsAppId: "1" })).toBeNull();
    expect(resolveTtsCredentials({})).toBeNull();
    expect(resolveTtsCredentials({ ttsApiKey: "   " })).toBeNull();
  });
});

describe("speech engine", () => {
  type Deps = Parameters<typeof createSpeechEngine>[0];
  const deps = (over: Partial<Deps> = {}): Deps => ({
    loadCredentials: async () => ({
      kind: "api-key",
      apiKey: "speech",
      source: "tts",
    }),
    synthesize: jest.fn(async () => ({ ok: true as const, chunks: ["AAAA"] })),
    playAudio: jest.fn(async () => true),
    speakOnDevice: jest.fn(async () => true),
    stopOnDevice: jest.fn(async () => undefined),
    ...over,
  });

  it("speaks Amanda's reply with her cloud voice and plays it through the native player", async () => {
    const d = deps();
    const engine = createSpeechEngine(d);
    await engine.speak({ id: "1", text: "我在呢。", voiceId: SEED_VOICES.amanda });
    expect(d.synthesize).toHaveBeenCalledTimes(1);
    expect((d.synthesize as jest.Mock).mock.calls[0][0]).toMatchObject({
      text: "我在呢。",
      voiceId: SEED_VOICES.amanda,
    });
    expect(d.playAudio).toHaveBeenCalledWith(["AAAA"]);
    expect(d.speakOnDevice).not.toHaveBeenCalled();
  });

  it("falls back to an on-device voice of the same gender when there are no cloud credentials", async () => {
    const d = deps({ loadCredentials: async () => null });
    const engine = createSpeechEngine(d);
    await engine.speak({ id: "1", text: "我在呢。", voiceId: SEED_VOICES.amanda });
    expect(d.synthesize).not.toHaveBeenCalled();
    expect(d.speakOnDevice).toHaveBeenCalledWith("我在呢。", {
      gender: "female",
      language: "zh-CN",
    });
    await engine.speak({ id: "2", text: "Hey there.", voiceId: SEED_VOICES.kevin });
    expect(d.speakOnDevice).toHaveBeenLastCalledWith("Hey there.", {
      gender: "male",
      language: "en-US",
    });
  });

  it("after the cloud refuses the key it stops asking for the rest of the session", async () => {
    const synthesize = jest.fn(async () => ({
      ok: false as const,
      reason: "auth" as const,
      message: "refused",
      status: 401,
    }));
    const d = deps({ synthesize });
    const engine = createSpeechEngine(d);
    await engine.speak({ id: "1", text: "hi", voiceId: SEED_VOICES.kevin });
    await engine.speak({ id: "2", text: "again", voiceId: SEED_VOICES.kevin });
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(d.speakOnDevice).toHaveBeenCalledTimes(2);
    expect((d.speakOnDevice as jest.Mock).mock.calls[1]).toEqual([
      "again",
      { gender: "male", language: "en-US" },
    ]);
  });

  it("a speaker the account has not enabled falls back for that voice only", async () => {
    const synthesize = jest.fn(async ({ voiceId }: { voiceId: string }) =>
      voiceId === SEED_VOICES.kevin
        ? { ok: false as const, reason: "voice" as const, message: "denied" }
        : { ok: true as const, chunks: ["BBBB"] }
    );
    const d = deps({ synthesize: synthesize as unknown as Deps["synthesize"] });
    const engine = createSpeechEngine(d);
    await engine.speak({ id: "1", text: "hi", voiceId: SEED_VOICES.kevin });
    await engine.speak({ id: "2", text: "hi", voiceId: SEED_VOICES.kevin });
    await engine.speak({ id: "3", text: "hi", voiceId: SEED_VOICES.amanda });
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(d.speakOnDevice).toHaveBeenCalledTimes(2);
    expect(d.playAudio).toHaveBeenCalledWith(["BBBB"]);
  });

  it("a stop during synthesis plays nothing and speaks nothing", async () => {
    const pending: {
      deliver: ((value: { ok: true; chunks: string[] }) => void) | null;
    } = { deliver: null };
    const synthesize = jest.fn(
      () =>
        new Promise<{ ok: true; chunks: string[] }>((resolve) => {
          pending.deliver = resolve;
        })
    );
    const d = deps({ synthesize: synthesize as unknown as Deps["synthesize"] });
    const engine = createSpeechEngine(d);
    const speaking = engine.speak({ id: "1", text: "hi", voiceId: SEED_VOICES.kevin });
    await Promise.resolve();
    await engine.stop();
    pending.deliver?.({ ok: true, chunks: ["AAAA"] });
    await speaking;
    expect(d.playAudio).not.toHaveBeenCalled();
    expect(d.speakOnDevice).not.toHaveBeenCalled();
    expect(d.stopOnDevice).toHaveBeenCalled();
  });

  it("a binary that cannot play audio still speaks on device", async () => {
    const d = deps({ playAudio: jest.fn(async () => false) });
    const engine = createSpeechEngine(d);
    await engine.speak({ id: "1", text: "hi", voiceId: SEED_VOICES.amanda });
    expect(d.speakOnDevice).toHaveBeenCalledWith("hi", {
      gender: "female",
      language: "en-US",
    });
  });

  it("an unknown voice id still speaks, with no gender forced", async () => {
    const d = deps({ loadCredentials: async () => null });
    const engine = createSpeechEngine(d);
    await engine.speak({ id: "1", text: "hi" });
    expect(d.speakOnDevice).toHaveBeenCalledWith("hi", {
      gender: undefined,
      language: "en-US",
    });
  });
});

describe("PHNative speech", () => {
  const source = readFileSync(
    join(__dirname, "../ios/AppFrontend/PHNative.mm"),
    "utf8"
  );

  it("speak() takes voice options and picks an AVSpeechSynthesisVoice by gender and language", () => {
    const speak = source.slice(
      source.indexOf("RCT_REMAP_METHOD(speak,"),
      source.indexOf("RCT_REMAP_METHOD(stopSpeaking,")
    );
    expect(speak).toContain("options:(NSDictionary *)options");
    expect(speak).toContain("voiceForOptions");
    expect(source).toContain("AVSpeechSynthesisVoiceGenderFemale");
    expect(source).toContain("AVSpeechSynthesisVoiceGenderMale");
    expect(source).toContain("[AVSpeechSynthesisVoice speechVoices]");
  });

  it("playAudio() plays base64 mp3 chunks through AVAudioPlayer on the playback session, and stopSpeaking() stops it", () => {
    expect(source).toContain("RCT_REMAP_METHOD(playAudio,");
    const play = source.slice(source.indexOf("RCT_REMAP_METHOD(playAudio,"));
    expect(play).toContain("initWithBase64EncodedString");
    expect(play).toContain("AVAudioPlayer");
    expect(play).toContain("ensurePlaybackAudioSession");
    expect(source).toContain("audioPlayerDidFinishPlaying");
    const stop = source.slice(
      source.indexOf("RCT_REMAP_METHOD(stopSpeaking,"),
      source.indexOf("RCT_REMAP_METHOD(playAudio,")
    );
    expect(stop).toContain("stopAudioPlayer");
  });
});
