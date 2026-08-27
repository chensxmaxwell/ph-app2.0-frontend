import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "user";

export type SessionUser = {
  id?: string;
  email?: string;
  token?: string;
  name?: string;
  nickName?: string;
};

type Listener = (user: SessionUser | null) => void;

const listeners = new Set<Listener>();

export const readSessionUser = async (): Promise<SessionUser | null> => {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
};

export const writeSessionUser = async (user: SessionUser | null) => {
  if (user) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem(USER_KEY);
  }
  listeners.forEach((listener) => listener(user));
};

export const subscribeSessionUser = (listener: Listener) => {
  listeners.add(listener);
  readSessionUser()
    .then(listener)
    .catch(() => listener(null));
  return () => {
    listeners.delete(listener);
  };
};

export const currentUserId = async (): Promise<string | null> => {
  const user = await readSessionUser();
  return user?.id ?? null;
};

export const storageKeyForUser = (userId: string | null | undefined, table: string) => {
  const id = userId && userId.length > 0 ? userId : "anon";
  return `ph.local.v1.${id}.${table}`;
};
