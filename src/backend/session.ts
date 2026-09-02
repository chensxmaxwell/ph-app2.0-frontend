import AsyncStorage from "@react-native-async-storage/async-storage";

export const SESSION_KEY = "user";

export type SessionUser = {
  id: string;
  email: string;
  token: string;
  name?: string;
  nickName?: string;
};

type Listener = (user: SessionUser | null) => void;

let current: SessionUser | null = null;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener(current));
};

const parseUser = (raw: string | null): SessionUser | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const getSessionUser = () => current;

export const getCurrentUserId = () => current?.id ?? null;

export const subscribeSessionUser = (listener: Listener) => {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
};

export const writeSessionUser = async (user: SessionUser | null) => {
  current = user
    ? {
        id: user.id,
        email: user.email,
        token: user.token,
        name: user.name,
        nickName: user.nickName,
      }
    : null;
  if (current) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(current));
  } else {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
  notify();
};

export const readSessionUser = async (): Promise<SessionUser | null> => {
  if (current) {
    return current;
  }
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  current = parseUser(raw);
  return current;
};

export const hydrateSession = async () => {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  current = parseUser(raw);
  notify();
  return current;
};

export const sessionReady = hydrateSession();

export const currentUserId = async (): Promise<string | null> => {
  const user = await readSessionUser();
  return user?.id ?? null;
};

export const STORE_KEYS = {
  accounts: "ph.accounts.v1",
  otps: "ph.otps.v1",
  companions: "ph.companions.v1",
  chat: "ph.chat.v2",
  alarms: "ph.alarms.v1",
  device: "ph.device.v1",
  patterns: "ph.patterns.v1",
  kinks: "ph.kinks.v1",
  kinkFavorites: "ph.kinkFavorites.v1",
  profile: "ph.profile.v1",
  loveSession: "ph.loveSession.v1",
  llm: "ph.llm.v1",
} as const;

export const scopedKey = (base: string, userId: string) => `${base}:${userId}`;

export const storageKeyForUser = (
  userId: string | null | undefined,
  base: string
) => scopedKey(base, userId && userId.length > 0 ? userId : "anon");
