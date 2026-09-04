import {
  NativeSpeakOptions,
  nativePlayAudio,
  nativeSpeak,
  nativeStartVoiceInput,
  nativeStopVoiceInput,
  nativeStopSpeaking,
} from "../native/ph-native";

export type VoiceInputResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; message: string; text?: string };

const fallbackDenied: VoiceInputResult = {
  ok: false,
  reason: "unavailable",
  message: "Voice input is not available on this build.",
};

const asResult = (value: unknown): VoiceInputResult => {
  if (!value || typeof value !== "object") {
    return fallbackDenied;
  }
  const record = value as {
    ok?: boolean;
    text?: string;
    reason?: string;
    message?: string;
  };
  if (record.ok) {
    return { ok: true, text: typeof record.text === "string" ? record.text : "" };
  }
  return {
    ok: false,
    reason: record.reason || "start-failed",
    message:
      record.message || "Could not start the microphone. Try again.",
    text: typeof record.text === "string" ? record.text : "",
  };
};

export const startVoiceInput = async (): Promise<VoiceInputResult> => {
  try {
    return asResult(await nativeStartVoiceInput());
  } catch {
    return fallbackDenied;
  }
};

export const stopVoiceInput = async (): Promise<VoiceInputResult> => {
  try {
    return asResult(await nativeStopVoiceInput());
  } catch {
    return fallbackDenied;
  }
};

export const speakWithNativeTts = async (
  text: string,
  options: NativeSpeakOptions = {}
) => {
  try {
    await nativeSpeak(text, options);
  } catch {
    // Listen must never crash the process.
  }
};

export const playAudioWithNative = async (chunks: string[]) => {
  try {
    return await nativePlayAudio(chunks);
  } catch {
    return false;
  }
};

export const stopNativeTts = async () => {
  try {
    await nativeStopSpeaking();
  } catch {
    // Already stopped.
  }
};
