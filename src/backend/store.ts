import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedThreads } from "./chat-seed";
import { storageKeyForUser } from "./session";
import type { ChatBubble, ChatThread } from "../screens/chat/types";

export const PREFIX = "ph.local.v1";
const USERS_KEY = `${PREFIX}.users`;
const OTPS_KEY = `${PREFIX}.otps`;
const CHAT_MIGRATED_KEY = `${PREFIX}.migrated.ph.chat.v2`;
const COMPANIONS_MIGRATED_KEY = `${PREFIX}.migrated.ph.companions.v1`;
const ALARMS_MIGRATED_KEY = `${PREFIX}.migrated.ph.alarms.v1`;
const DEVICE_MIGRATED_KEY = `${PREFIX}.migrated.ph.device.v1`;
const LEGACY_CHAT_KEY = "ph.chat.v2";
const LEGACY_COMPANIONS_KEY = "ph.companions.v1";
const LEGACY_ALARMS_KEY = "ph.alarms.v1";
const LEGACY_DEVICE_KEY = "ph.device.v1";

export type LocalUser = {
  id: string;
  email: string;
  token: string;
  passwordHash: string;
  google?: boolean;
};

export type LocalProfile = {
  userId: string;
  nickName?: string;
  profilePicture?: string;
  personalInfo?: {
    age?: string;
    height?: string;
    weight?: string;
    biographicalInfo?: string;
    sexualOrientation?: string;
    birthday?: string;
  };
};

export type LocalDevice = {
  id: string;
  userId: string;
  name?: string;
  peripheralID?: string;
  settings?: { intensity?: number; mode?: string };
  userData?: { timeStamp?: string; data?: string }[];
  userOnboardingData?: { timeStamp?: string; data?: string }[];
};

export type LocalChatThread = Omit<ChatThread, "messages"> & {
  userId: string;
};

export type LocalChatMessage = ChatBubble & {
  threadId: string;
  userId: string;
};

export type LocalCompanion = {
  id: string;
  userId: string;
  name?: string;
  gender?: string;
  birthday?: string;
  personalities?: string[];
  story?: string;
  passionateTender?: number;
  dominantSubmissive?: number;
  experimentalVanilla?: number;
  payload?: string;
};

export type LocalRecord = {
  id: string;
  userId: string;
  kind: string;
  payload?: string;
};

export type LocalOtp = {
  email: string;
  code: string;
};

const PASSWORD_SALT = "ph.local.v1";

export const hashPassword = (password: string) => {
  let hash = 2166136261;
  const input = `${PASSWORD_SALT}:${password}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${PASSWORD_SALT}:${(hash >>> 0).toString(16)}`;
};

export const nextId = (prefix = "id") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

const readJson = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const getUsers = async () => readJson<LocalUser[]>(USERS_KEY, []);
export const setUsers = async (users: LocalUser[]) => writeJson(USERS_KEY, users);

const table = async <T,>(userId: string, name: string, fallback: T): Promise<T> =>
  readJson<T>(storageKeyForUser(userId, name), fallback);

const setTable = async (userId: string, name: string, value: unknown) =>
  writeJson(storageKeyForUser(userId, name), value);

export const getProfiles = (userId: string) =>
  table<LocalProfile[]>(userId, "profiles", []);
export const setProfiles = (userId: string, rows: LocalProfile[]) =>
  setTable(userId, "profiles", rows);

export const getDevices = (userId: string) =>
  table<LocalDevice[]>(userId, "devices", []);
export const setDevices = (userId: string, rows: LocalDevice[]) =>
  setTable(userId, "devices", rows);

export const getThreadRows = (userId: string) =>
  table<LocalChatThread[]>(userId, "chat_threads", []);
export const setThreadRows = (userId: string, rows: LocalChatThread[]) =>
  setTable(userId, "chat_threads", rows);

export const getMessageRows = (userId: string) =>
  table<LocalChatMessage[]>(userId, "chat_messages", []);
export const setMessageRows = (userId: string, rows: LocalChatMessage[]) =>
  setTable(userId, "chat_messages", rows);

export const getCompanions = (userId: string) =>
  table<LocalCompanion[]>(userId, "companions", []);
export const setCompanions = (userId: string, rows: LocalCompanion[]) =>
  setTable(userId, "companions", rows);

export const getRecords = (userId: string) =>
  table<LocalRecord[]>(userId, "records", []);
export const setRecords = (userId: string, rows: LocalRecord[]) =>
  setTable(userId, "records", rows);

export const getOtps = () => readJson<LocalOtp[]>(OTPS_KEY, []);
export const setOtps = (rows: LocalOtp[]) => writeJson(OTPS_KEY, rows);

const seededBypass = (): LocalUser => ({
  id: "bypass",
  email: "bypass@local",
  token: "bypass",
  passwordHash: hashPassword("bypass"),
});

const seededDemo = (): LocalUser => ({
  id: "demo",
  email: "demo@local",
  token: "local.demo",
  passwordHash: hashPassword("demo1234"),
});

export const ensureSeeded = async () => {
  const users = await getUsers();
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const byId = new Map(users.map((user) => [user.id, user]));
  const next = [...users];
  if (!byId.has("bypass") && !byEmail.has("bypass@local")) {
    next.push(seededBypass());
  }
  if (!byId.has("demo") && !byEmail.has("demo@local")) {
    next.push(seededDemo());
  }
  if (next.length !== users.length) {
    await setUsers(next);
  }
};

export const findUserByToken = async (token?: string | null) => {
  await ensureSeeded();
  if (!token) {
    return null;
  }
  const trimmed = token.replace(/^Bearer\s+/i, "").trim();
  if (!trimmed) {
    return null;
  }
  const users = await getUsers();
  return (
    users.find(
      (user) =>
        user.token === trimmed ||
        user.id === trimmed ||
        (trimmed === "bypass" && user.id === "bypass")
    ) ?? null
  );
};

export const findUserByEmail = async (email: string) => {
  await ensureSeeded();
  const users = await getUsers();
  return (
    users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase()) ??
    null
  );
};

const importThread = async (userId: string, thread: ChatThread) => {
  const threads = await getThreadRows(userId);
  const messages = await getMessageRows(userId);
  const { messages: bubbles = [], ...rest } = thread;
  const existingIndex = threads.findIndex((item) => item.id === thread.id);
  const row: LocalChatThread = { ...rest, id: thread.id, userId };
  if (existingIndex === -1) {
    threads.push(row);
  } else {
    threads[existingIndex] = row;
  }
  const kept = messages.filter((item) => item.threadId !== thread.id);
  const imported = bubbles.map((bubble, index) => ({
    ...bubble,
    id: bubble.id || `${thread.id}-m${index}`,
    threadId: thread.id,
    userId,
    voice: bubble.voice === true,
  }));
  await setThreadRows(userId, threads);
  await setMessageRows(userId, [...kept, ...imported]);
};

export const migrateLegacyChatOnce = async (userId: string) => {
  const already = await AsyncStorage.getItem(CHAT_MIGRATED_KEY);
  if (already) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(LEGACY_CHAT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        threads?: ChatThread[];
        isPremium?: boolean;
      };
      if (Array.isArray(parsed.threads) && parsed.threads.length > 0) {
        for (const thread of parsed.threads) {
          await importThread(userId, thread);
        }
      }
      if (typeof parsed.isPremium === "boolean") {
        const records = await getRecords(userId);
        const existing = records.find(
          (item) => item.kind === "settings" && item.id === "premium"
        );
        const row: LocalRecord = {
          id: "premium",
          userId,
          kind: "settings",
          payload: JSON.stringify({ isPremium: parsed.isPremium }),
        };
        if (existing) {
          await setRecords(
            userId,
            records.map((item) => (item.id === "premium" ? row : item))
          );
        } else {
          await setRecords(userId, [...records, row]);
        }
      }
    }
  } catch {
    // ignore corrupt legacy chat
  }
  await AsyncStorage.setItem(CHAT_MIGRATED_KEY, userId);
};

export const migrateLegacyCompanionsOnce = async (userId: string) => {
  const already = await AsyncStorage.getItem(COMPANIONS_MIGRATED_KEY);
  if (already) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(LEGACY_COMPANIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        companions?: LocalCompanion[];
        activeCompanionId?: string | null;
      };
      if (Array.isArray(parsed.companions) && parsed.companions.length > 0) {
        const rows = parsed.companions.map((companion) => ({
          ...companion,
          userId,
          payload: companion.payload || JSON.stringify({ ...companion, userId }),
        }));
        await setCompanions(userId, rows);
      }
      if (parsed.activeCompanionId) {
        const records = await getRecords(userId);
        await setRecords(userId, [
          ...records.filter((item) => item.id !== "activeCompanionId"),
          {
            id: "activeCompanionId",
            userId,
            kind: "settings",
            payload: parsed.activeCompanionId,
          },
        ]);
      }
    }
  } catch {
    // ignore corrupt companions
  }
  await AsyncStorage.setItem(COMPANIONS_MIGRATED_KEY, userId);
};

export const migrateLegacyAlarmsOnce = async (userId: string) => {
  const already = await AsyncStorage.getItem(ALARMS_MIGRATED_KEY);
  if (already) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(LEGACY_ALARMS_KEY);
    const dest = storageKeyForUser(userId, "alarms");
    const existing = await AsyncStorage.getItem(dest);
    if (raw && !existing) {
      await AsyncStorage.setItem(dest, raw);
    }
  } catch {
    // ignore
  }
  await AsyncStorage.setItem(ALARMS_MIGRATED_KEY, userId);
};

export const migrateLegacyDeviceOnce = async (userId: string) => {
  const already = await AsyncStorage.getItem(DEVICE_MIGRATED_KEY);
  if (already) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(LEGACY_DEVICE_KEY);
    const dest = storageKeyForUser(userId, "device");
    const existing = await AsyncStorage.getItem(dest);
    if (raw && !existing) {
      await AsyncStorage.setItem(dest, raw);
    }
  } catch {
    // ignore
  }
  await AsyncStorage.setItem(DEVICE_MIGRATED_KEY, userId);
};

export const ensureUserData = async (userId: string) => {
  await ensureSeeded();
  await migrateLegacyChatOnce(userId);
  await migrateLegacyCompanionsOnce(userId);
  await migrateLegacyAlarmsOnce(userId);
  await migrateLegacyDeviceOnce(userId);
  const threads = await getThreadRows(userId);
  if (threads.length === 0) {
    for (const thread of seedThreads()) {
      await importThread(userId, thread);
    }
  }
};

export const assembleThread = async (
  userId: string,
  thread: LocalChatThread
): Promise<ChatThread> => {
  const messages = await getMessageRows(userId);
  return {
    ...thread,
    messages: messages
      .filter((item) => item.threadId === thread.id)
      .map(({ threadId: _threadId, userId: _userId, ...bubble }) => ({
        ...bubble,
        voice: bubble.voice === true ? true : undefined,
      })),
  };
};

export const listChatThreads = async (userId: string): Promise<ChatThread[]> => {
  await ensureUserData(userId);
  const threads = await getThreadRows(userId);
  const assembled = await Promise.all(
    threads.map((thread) => assembleThread(userId, thread))
  );
  return assembled;
};

export const getChatThread = async (userId: string, id: string) => {
  await ensureUserData(userId);
  const threads = await getThreadRows(userId);
  const thread = threads.find((item) => item.id === id);
  if (!thread) {
    return null;
  }
  return assembleThread(userId, thread);
};

export const upsertThread = async (
  userId: string,
  input: Partial<ChatThread> & { id?: string }
) => {
  await ensureUserData(userId);
  const id = input.id || nextId("thread");
  const existing = await getChatThread(userId, id);
  const merged: ChatThread = {
    id,
    name: input.name ?? existing?.name ?? "",
    kind: input.kind === "human" || existing?.kind === "human" ? "human" : "bot",
    email: input.email ?? existing?.email,
    preview: input.preview ?? existing?.preview ?? "",
    time: input.time ?? existing?.time ?? "Now",
    pinned: input.pinned ?? existing?.pinned ?? false,
    listen: input.listen ?? existing?.listen ?? false,
    synced: input.synced ?? existing?.synced ?? false,
    request: input.request ?? existing?.request ?? "none",
    gender: input.gender ?? existing?.gender,
    birthday: input.birthday ?? existing?.birthday,
    description: input.description ?? existing?.description,
    personality: input.personality ?? existing?.personality,
    messages:
      input.messages !== undefined ? input.messages : existing?.messages ?? [],
  };
  await importThread(userId, merged);
  return getChatThread(userId, id);
};

export const appendMessage = async (
  userId: string,
  threadId: string,
  message: ChatBubble
) => {
  await ensureUserData(userId);
  let thread = await getChatThread(userId, threadId);
  if (!thread) {
    thread = {
      id: threadId,
      name: threadId,
      kind: "bot",
      preview: message.text,
      time: "Now",
      pinned: false,
      listen: false,
      synced: false,
      request: "none",
      messages: [],
    };
  }
  const bubble: ChatBubble = {
    ...message,
    id: message.id || nextId("msg"),
    voice: message.voice === true,
  };
  const next: ChatThread = {
    ...thread,
    preview: message.text,
    time: "Now",
    messages: [...thread.messages, bubble],
  };
  await importThread(userId, next);
  return getChatThread(userId, threadId);
};

export const removeThread = async (userId: string, id: string) => {
  const threads = await getThreadRows(userId);
  const messages = await getMessageRows(userId);
  await setThreadRows(
    userId,
    threads.filter((item) => item.id !== id)
  );
  await setMessageRows(
    userId,
    messages.filter((item) => item.threadId !== id)
  );
  return true;
};
