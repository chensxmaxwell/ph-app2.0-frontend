import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LLM_API_KEY,
  LLM_BASE_URL,
  LLM_MODEL,
} from "./llm-env.generated";

const STORAGE_KEY = "ph.llm.v1";

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const envDefaults = (): LlmConfig => ({
  apiKey: LLM_API_KEY || "",
  baseUrl: LLM_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
  model: LLM_MODEL || "deepseek-v4-flash-ga-260731",
});

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
      apiKey: parsed.apiKey || defaults.apiKey,
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
