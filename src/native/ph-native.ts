import { NativeModules, Platform } from "react-native";
type PHNativeModule = {
  avatarViewerUrl?: string | null;
  requestNotifications?: () => Promise<boolean>;
  syncAlarms?: (alarms: Array<Record<string, unknown>>) => Promise<boolean>;
};

const Native = NativeModules.PHNative as PHNativeModule | undefined;

export const bundledAvatarViewerUrl = (): string | null => {
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
