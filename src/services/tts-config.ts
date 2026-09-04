import {
  LLM_API_KEY,
  TTS_ACCESS_TOKEN,
  TTS_API_KEY,
  TTS_APP_ID,
} from "@env";
import type { LlmConfig } from "./llm-config";

// Who the Doubao speech endpoint is told we are. The new 豆包语音 console
// issues one API key (`X-Api-Key`); older apps have an APP ID + Access Token.
export type TtsCredentials =
  | {
      kind: "api-key";
      apiKey: string;
      // `tts`: a key from the speech console. `ark`: the LLM key, tried
      // because it is the same vendor and Maxwell asked for one credential;
      // the speech console issues a separate key, so expect a refusal and
      // let the engine drop it for the session.
      source: "tts" | "ark";
    }
  | { kind: "app"; appId: string; accessToken: string };

export type TtsCredentialInputs = {
  ttsApiKey?: string;
  ttsAppId?: string;
  ttsAccessToken?: string;
  arkApiKey?: string;
};

const clean = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveTtsCredentials = (
  inputs: TtsCredentialInputs
): TtsCredentials | null => {
  const ttsKey = clean(inputs.ttsApiKey);
  if (ttsKey) {
    return { kind: "api-key", apiKey: ttsKey, source: "tts" };
  }
  const appId = clean(inputs.ttsAppId);
  const accessToken = clean(inputs.ttsAccessToken);
  if (appId && accessToken) {
    return { kind: "app", appId, accessToken };
  }
  const arkKey = clean(inputs.arkApiKey);
  if (arkKey) {
    return { kind: "api-key", apiKey: arkKey, source: "ark" };
  }
  return null;
};

// `@env` is inlined at build time (static import only — never require() it,
// landmine 10). The saved Companion AI settings win over the shipped .env.
export const ttsCredentialsFromConfig = (
  config: LlmConfig
): TtsCredentials | null =>
  resolveTtsCredentials({
    ttsApiKey: config.ttsApiKey ?? TTS_API_KEY,
    ttsAppId: TTS_APP_ID,
    ttsAccessToken: TTS_ACCESS_TOKEN,
    arkApiKey: config.apiKey || LLM_API_KEY,
  });
