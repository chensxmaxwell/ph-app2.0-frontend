import { NativeModules, Platform } from "react-native";

export type NativeVoiceResult = {
  ok?: boolean;
  text?: string;
  reason?: string;
  message?: string;
};

type PHNativeModule = {
  avatarViewerUrl?: string | null;
  requestNotifications?: () => Promise<boolean>;
  syncAlarms?: (alarms: Array<Record<string, unknown>>) => Promise<boolean>;
  speak?: (text: string) => Promise<boolean>;
  stopSpeaking?: () => Promise<boolean>;
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

export const nativeSpeak = async (text: string) => {
  if (!Native?.speak) {
    return false;
  }
  try {
    return (await Native.speak(text)) === true;
  } catch {
    return false;
  }
};

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
