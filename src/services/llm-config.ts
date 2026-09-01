import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  STORE_KEYS,
  currentUserId,
  scopedKey,
} from "../backend/session";

export const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
export const ARK_MODEL = "deepseek-v4-flash-ga-260731";

const LEGACY_GLOBAL_KEY = "ph.llm.v1";

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type EnvLlm = {
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
};

// Metro @env is optional and empty in Release IPAs. Keep this require inside
// try/catch so a missing dotenv module cannot crash companion chat.
const readEnvOverlay = (): Partial<LlmConfig> => {
  try {
    const env = require("@env") as EnvLlm;
    return {
      apiKey: env.LLM_API_KEY ?? "",
      baseUrl: env.LLM_BASE_URL,
      model: env.LLM_MODEL,
    };
  } catch {
    return {};
  }
};

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
    })
  );
};

export const hasLlmKey = (config: LlmConfig) => config.apiKey.trim().length > 0;
