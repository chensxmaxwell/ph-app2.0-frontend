export type MicStartFailure =
  | "permission-denied"
  | "unavailable"
  | "start-failed";

export type MicStartResult =
  | { ok: true }
  | { ok: false; reason: MicStartFailure; message: string };

export const MIC_ERROR_MESSAGES: Record<MicStartFailure, string> = {
  "permission-denied": "Microphone access is needed to use voice input.",
  unavailable: "Voice input is not available on this build.",
  "start-failed": "Could not start the microphone. Try again.",
};

const looksLikePermissionError = (text: string) => {
  const lower = text.toLowerCase();
  return (
    lower.includes("permission") ||
    lower.includes("denied") ||
    lower.includes("not authorized") ||
    lower.includes("notauthorized")
  );
};

const looksLikeMissingNative = (text: string) => {
  const lower = text.toLowerCase();
  return (
    lower.includes("native module") ||
    lower.includes("null is not an object") ||
    lower.includes("undefined is not an object") ||
    lower.includes("cannot read property") ||
    lower.includes("is not a function") ||
    lower.includes("not available")
  );
};

export const startMicSession = async (input: {
  platform: string;
  requestAndroidAudio?: () => Promise<boolean>;
  startRecorder: () => Promise<unknown>;
}): Promise<MicStartResult> => {
  try {
    if (input.platform === "android") {
      const granted = input.requestAndroidAudio
        ? await input.requestAndroidAudio()
        : false;
      if (!granted) {
        return {
          ok: false,
          reason: "permission-denied",
          message: MIC_ERROR_MESSAGES["permission-denied"],
        };
      }
    }
    await input.startRecorder();
    return { ok: true };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error ?? "");
    if (looksLikePermissionError(text)) {
      return {
        ok: false,
        reason: "permission-denied",
        message: MIC_ERROR_MESSAGES["permission-denied"],
      };
    }
    if (looksLikeMissingNative(text)) {
      return {
        ok: false,
        reason: "unavailable",
        message: MIC_ERROR_MESSAGES.unavailable,
      };
    }
    return {
      ok: false,
      reason: "start-failed",
      message: MIC_ERROR_MESSAGES["start-failed"],
    };
  }
};

export const stopMicSession = async (stopRecorder: () => Promise<unknown>) => {
  try {
    await stopRecorder();
  } catch {
    // Already stopped, denied, or native module missing.
  }
};
