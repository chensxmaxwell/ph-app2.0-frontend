import { NativeModules, Platform } from "react-native";

export type NativeVoiceResult = {
  ok?: boolean;
  text?: string;
  reason?: string;
  message?: string;
};

// How AVSpeechSynthesizer should sound: a voice of this gender for this
// language (picked natively from the installed voices), or an exact voice id.
export type NativeSpeakOptions = {
  gender?: "female" | "male";
  language?: string;
  voiceIdentifier?: string;
};

type PHNativeModule = {
  avatarViewerUrl?: string | null;
  requestNotifications?: () => Promise<boolean>;
  syncAlarms?: (alarms: Array<Record<string, unknown>>) => Promise<boolean>;
  speak?: (text: string, options: NativeSpeakOptions) => Promise<boolean>;
  stopSpeaking?: () => Promise<boolean>;
  // Base64 MP3 pieces, decoded and concatenated natively, played with
  // AVAudioPlayer on the playback session; resolves when playback ends.
  playAudio?: (chunks: string[]) => Promise<boolean>;
  startVoiceInput?: () => Promise<NativeVoiceResult>;
  stopVoiceInput?: () => Promise<NativeVoiceResult>;
};

const Native = NativeModules.PHNative as PHNativeModule | undefined;

export const bundledAvatarViewerUrl = (): string | null => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return null;
  }
  if (Platform.OS === "android") {
    return "file:///android_asset/avatar-engine/viewer-page.html";
  }
  const url = Native?.avatarViewerUrl;
  return typeof url === "string" && url.startsWith("file:") ? url : null;
};

type AlarmPayload = {
  id: string;
  name: string;
  hour: number;
  minute: number;
  days: string[];
  enabled: boolean;
};

export const syncNativeAlarms = async (alarms: AlarmPayload[]) => {
  if (!Native?.syncAlarms) {
    return;
  }
  try {
    await Native.requestNotifications?.();
    await Native.syncAlarms(
      alarms.map((alarm) => ({
        id: alarm.id,
        name: alarm.name,
        hour: alarm.hour,
        minute: alarm.minute,
        days: alarm.days,
        enabled: alarm.enabled,
      }))
    );
  } catch {
    // Rebuild the native app before local notifications are available.
  }
};

export const nativeSpeak = async (
  text: string,
  options: NativeSpeakOptions = {}
) => {
  if (!Native?.speak) {
    return false;
  }
  try {
    return (await Native.speak(text, options)) === true;
  } catch {
    return false;
  }
};

// Stops both the synthesizer and the audio player.
export const nativeStopSpeaking = async () => {
  if (!Native?.stopSpeaking) {
    return;
  }
  try {
    await Native.stopSpeaking();
  } catch {
    // Already stopped or native module missing.
  }
};

export const nativePlayAudio = async (chunks: string[]) => {
  if (!Native?.playAudio || chunks.length === 0) {
    return false;
  }
  try {
    return (await Native.playAudio(chunks)) === true;
  } catch {
    return false;
  }
};

export const nativeStartVoiceInput = async (): Promise<NativeVoiceResult> => {
  if (!Native?.startVoiceInput) {
    return {
      ok: false,
      reason: "unavailable",
      message: "Voice input is not available on this build.",
    };
  }
  try {
    return await Native.startVoiceInput();
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "Voice input is not available on this build.",
    };
  }
};

export const nativeStopVoiceInput = async (): Promise<NativeVoiceResult> => {
  if (!Native?.stopVoiceInput) {
    return {
      ok: false,
      reason: "unavailable",
      message: "Voice input is not available on this build.",
    };
  }
  try {
    return await Native.stopVoiceInput();
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "Voice input is not available on this build.",
    };
  }
};
