import AsyncStorage from "@react-native-async-storage/async-storage";
import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } from "@env";
import { STORE_KEYS, currentUserId, scopedKey } from "../backend/session";

export const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
export const ARK_MODEL = "deepseek-v4-flash-ga-260731";

const LEGACY_GLOBAL_KEY = "ph.llm.v1";

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  // 豆包语音 (speech console) API key for cloud TTS; the speech console issues
  // its own key, separate from the Ark key above. Optional: blobs saved
  // before voices existed have none.
  ttsApiKey?: string;
  // MiniMax platform API key (speech-2.8-hd through T2A v2). When saved it
  // is the voice that speaks, ahead of Doubao. Stored like the other keys:
  // on this account on this phone, never logged, never uploaded.
  minimaxApiKey?: string;
};

const envString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

// react-native-dotenv inlines the `@env` import above at build time, so
// there is no module to look up on the phone. Never load `@env` with a
// runtime require() here (even inside try/catch): Metro 0.80 silently drops
// an optional dependency it cannot resolve and shifts every later
// `_dependencyMap` index, so a later require in this file becomes
// require(undefined) and the Metro runtime reports that as a fatal error ->
// RCTFatal in Release. That fired on the first loadLlmConfig(), i.e. on send.
const readEnvOverlay = (): Partial<LlmConfig> => ({
  apiKey: envString(LLM_API_KEY) ?? "",
  baseUrl: envString(LLM_BASE_URL),
  model: envString(LLM_MODEL),
});

export const defaultLlmConfig = (): LlmConfig => {
  const env = readEnvOverlay();
  return {
    apiKey: env.apiKey ?? "",
    baseUrl: env.baseUrl || ARK_BASE_URL,
    model: env.model || ARK_MODEL,
  };
};

const resolveUserId = async (userId?: string | null) => {
  if (userId && userId.length > 0) {
    return userId;
  }
  return (await currentUserId()) || "anon";
};

const parseStored = (raw: string, defaults: LlmConfig): LlmConfig => {
  const parsed = JSON.parse(raw) as Partial<LlmConfig>;
  return {
    apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : defaults.apiKey,
    baseUrl: parsed.baseUrl || defaults.baseUrl,
    model: parsed.model || defaults.model,
    ttsApiKey:
      typeof parsed.ttsApiKey === "string" ? parsed.ttsApiKey : undefined,
    minimaxApiKey:
      typeof parsed.minimaxApiKey === "string"
        ? parsed.minimaxApiKey
        : undefined,
  };
};

export const loadLlmConfig = async (
  userId?: string | null
): Promise<LlmConfig> => {
  const defaults = defaultLlmConfig();
  const id = await resolveUserId(userId);
  const key = scopedKey(STORE_KEYS.llm, id);
  try {
    let raw = await AsyncStorage.getItem(key);
    if (!raw) {
      const legacy = await AsyncStorage.getItem(LEGACY_GLOBAL_KEY);
      if (legacy) {
        raw = legacy;
        await AsyncStorage.setItem(key, legacy);
        await AsyncStorage.removeItem(LEGACY_GLOBAL_KEY);
      }
    }
    if (!raw) {
      return defaults;
    }
    return parseStored(raw, defaults);
  } catch {
    return defaults;
  }
};

export const saveLlmConfig = async (
  next: LlmConfig,
  userId?: string | null
) => {
  const id = await resolveUserId(userId);
  await AsyncStorage.setItem(
    scopedKey(STORE_KEYS.llm, id),
    JSON.stringify({
      apiKey: next.apiKey,
      baseUrl: next.baseUrl.trim() || ARK_BASE_URL,
      model: next.model.trim() || ARK_MODEL,
      ttsApiKey: next.ttsApiKey?.trim() || undefined,
      minimaxApiKey: next.minimaxApiKey?.trim() || undefined,
    })
  );
};

export const hasLlmKey = (config: LlmConfig) => config.apiKey.trim().length > 0;
