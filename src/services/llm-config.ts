import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ph.llm.v1";

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const envDefaults = (): LlmConfig => {
  try {
    const env = require("@env") as {
      LLM_API_KEY?: string;
      LLM_BASE_URL?: string;
      LLM_MODEL?: string;
    };
    return {
      apiKey: env.LLM_API_KEY ?? "",
      baseUrl: env.LLM_BASE_URL || "https://api.openai.com/v1",
      model: env.LLM_MODEL || "gpt-4o-mini",
    };
  } catch {
    return {
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    };
  }
};

export const defaultLlmConfig = envDefaults;

export const loadLlmConfig = async (): Promise<LlmConfig> => {
  const defaults = envDefaults();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    return {
      apiKey: parsed.apiKey ?? defaults.apiKey,
      baseUrl: parsed.baseUrl || defaults.baseUrl,
      model: parsed.model || defaults.model,
    };
  } catch {
    return defaults;
  }
};

export const saveLlmConfig = async (next: LlmConfig) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const hasLlmKey = (config: LlmConfig) => config.apiKey.trim().length > 0;
