import AsyncStorage from "@react-native-async-storage/async-storage";
import { BUILTIN_PATTERNS } from "./patterns";

const STORAGE_KEY = "ph.alarms.v1";

export type SavedAlarm = {
  id: string;
  name: string;
  hour: number;
  minute: number;
  days: string[];
  patternTitle: string;
  pattern: number[];
  enabled: boolean;
};

export type AlarmTime = {
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
};

export type AlarmDraft = {
  patternTitle: string;
  pattern: number[];
};

let draft: AlarmDraft = {
  patternTitle: BUILTIN_PATTERNS[0].title,
  pattern: BUILTIN_PATTERNS[0].pattern,
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const defaultAlarmTime = (): AlarmTime => ({
  hour: "08",
  minute: "30",
  ampm: "AM",
});

export const to24Hour = ({ hour, minute, ampm }: AlarmTime) => {
  let next = Number(hour) % 12;
  if (ampm === "PM") {
    next += 12;
  }
  return { hour: next, minute: Number(minute) };
};

export const formatAlarmTime = (hour: number, minute: number) => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, "0")} ${ampm}`;
};

export const getAlarmDraft = () => draft;

export const setAlarmDraft = (next: AlarmDraft) => {
  draft = next;
};

export const loadAlarms = async (): Promise<SavedAlarm[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as SavedAlarm[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveAlarms = async (alarms: SavedAlarm[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
};

export const addAlarm = async (alarm: Omit<SavedAlarm, "id" | "enabled">) => {
  const alarms = await loadAlarms();
  const next: SavedAlarm = {
    ...alarm,
    id: `${Date.now()}`,
    enabled: true,
  };
  await saveAlarms([next, ...alarms]);
  return next;
};

export const updateAlarm = async (
  id: string,
  patch: Partial<SavedAlarm>
) => {
  const alarms = await loadAlarms();
  await saveAlarms(
    alarms.map((item) => (item.id === id ? { ...item, ...patch } : item))
  );
};

export const removeAlarm = async (id: string) => {
  const alarms = await loadAlarms();
  await saveAlarms(alarms.filter((item) => item.id !== id));
};

export const weekdayLabel = (date: Date) => WEEKDAYS[date.getDay()];

export const alarmMatchesNow = (alarm: SavedAlarm, now: Date) => {
  if (!alarm.enabled) {
    return false;
  }
  const days = alarm.days.filter(Boolean);
  if (days.length > 0 && !days.includes(weekdayLabel(now))) {
    return false;
  }
  return now.getHours() === alarm.hour && now.getMinutes() === alarm.minute;
};
