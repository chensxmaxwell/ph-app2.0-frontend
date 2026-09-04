import {
  NativeListenOptions,
  NativeSpeakOptions,
  nativeListenForUtterance,
  nativePlayAudio,
  nativeSpeak,
  nativeStartVoiceInput,
  nativeStopVoiceInput,
  nativeStopSpeaking,
} from "../native/ph-native";

export type VoiceInputResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; message: string; text?: string };

export type UtteranceEnd = "utterance" | "idle" | "stopped";

// One hands-free turn of the call: what was heard and why the listen ended.
export type UtteranceResult =
  | { ok: true; text: string; end: UtteranceEnd }
  | { ok: false; reason: string; message: string };

export type UtteranceOptions = NativeListenOptions;

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

const isUtteranceEnd = (value: unknown): value is UtteranceEnd =>
  value === "utterance" || value === "idle" || value === "stopped";

// Opens the mic and resolves when the native side decides the user has
// finished talking (or nothing was said in time, or someone stopped the mic).
// Never throws: a build without the method reports `unavailable`.
export const listenForUtterance = async (
  options: UtteranceOptions = {}
): Promise<UtteranceResult> => {
  let raw: unknown;
  try {
    raw = await nativeListenForUtterance(options);
  } catch {
    return fallbackDenied;
  }
  const result = asResult(raw);
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: result.message };
  }
  const end = (raw as { end?: unknown } | null)?.end;
  return {
    ok: true,
    text: result.text,
    end: isUtteranceEnd(end) ? end : "utterance",
  };
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
