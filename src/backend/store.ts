import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatBubble, ChatThread } from "../screens/chat/types";
import { seedThreads } from "./chat-seed";
import {
  StoredChatThread,
  normalizeThreadTimestamps,
} from "./chat-timestamps";
import {
  STORE_KEYS,
  SessionUser,
  scopedKey,
  writeSessionUser,
} from "./session";

export type LocalUser = {
  id: string;
  email: string;
  token: string;
  passwordHash: string;
  google?: boolean;
  nickName?: string;
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

export type SavedPattern = {
  id: string;
  title: string;
  pattern: number[];
};

export type SavedKink = {
  id: string;
  name: string;
  emotion?: string | null;
  intensity?: number;
  sensitivity?: number;
  funType?: string;
  iconIndex?: number;
};

type CompanionBlob = {
  companions: any[];
  activeCompanionId: string | null;
};

type ChatBlob = {
  threads: ChatThread[];
  isPremium?: boolean;
  // Threads the user deleted from the Message list. Seeded bots are merged
  // back in on every hydrate unless their id is listed here.
  deletedThreadIds?: string[];
};

const MIGRATION_FLAG = "ph.namespace.migrated.v1";
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

export const getUsers = async () =>
  readJson<LocalUser[]>(STORE_KEYS.accounts, []);
export const setUsers = async (users: LocalUser[]) =>
  writeJson(STORE_KEYS.accounts, users);

const seededBypass = (): LocalUser => ({
  id: "bypass",
  email: "bypass@local",
  token: "bypass",
  passwordHash: hashPassword("bypass"),
  nickName: "Anonymous User",
});

const seededDemo = (): LocalUser => ({
  id: "demo",
  email: "demo@local",
  token: "local.demo",
  passwordHash: hashPassword("demo1234"),
  nickName: "Demo",
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
  const demo = next.find((user) => user.id === "demo");
  if (demo) {
    const profile = await getProfile(demo.id);
    if (!profile) {
      await setProfile({
        userId: demo.id,
        nickName: "Demo",
        personalInfo: { birthday: "01/01/2000" },
      });
    }
  }
};

export const findUserByToken = async (token?: string | null) => {
  await ensureSeeded();
  if (!token) {
    return null;
  }
  const trimmed = String(token).replace(/^Bearer\s+/i, "").trim();
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
    users.find(
      (user) => user.email.toLowerCase() === email.trim().toLowerCase()
    ) ?? null
  );
};

export const publicUser = (user: LocalUser): SessionUser => ({
  id: user.id,
  email: user.email,
  token: user.token,
  nickName: user.nickName,
  name: user.nickName,
});

export const migrateLegacyStores = async (userId: string) => {
  if (!userId) {
    return;
  }
  const done = await AsyncStorage.getItem(MIGRATION_FLAG);
  if (done) {
    return;
  }
  const bases = [
    STORE_KEYS.companions,
    STORE_KEYS.chat,
    STORE_KEYS.alarms,
    STORE_KEYS.device,
    STORE_KEYS.patterns,
    STORE_KEYS.kinks,
  ];
  for (const base of bases) {
    const namespaced = await AsyncStorage.getItem(scopedKey(base, userId));
    if (namespaced) {
      continue;
    }
    const legacy = await AsyncStorage.getItem(base);
    if (legacy) {
      await AsyncStorage.setItem(scopedKey(base, userId), legacy);
    }
  }
  await AsyncStorage.setItem(MIGRATION_FLAG, userId);
};

export const readUserStore = async <T,>(
  base: string,
  userId: string,
  fallback: T
): Promise<T> => {
  await migrateLegacyStores(userId);
  return readJson(scopedKey(base, userId), fallback);
};

export const writeUserStore = async (
  base: string,
  userId: string,
  value: unknown
) => {
  await writeJson(scopedKey(base, userId), value);
};

export const getProfile = async (userId: string) =>
  readUserStore<LocalProfile | null>(STORE_KEYS.profile, userId, null);

export const setProfile = async (profile: LocalProfile) =>
  writeUserStore(STORE_KEYS.profile, profile.userId, profile);

// Blobs written before `sentAt` / `lastActivityAt` existed only carry the
// display string `time`. Stamp every bubble and thread with a real epoch and
// write the migrated blob back so the recovered times are stable across reads.
const withTimestamps = async (
  userId: string,
  blob: ChatBlob & { threads: StoredChatThread[] }
): Promise<ChatBlob> => {
  const now = Date.now();
  const seeds = new Map(seedThreads(now).map((seed) => [seed.id, seed]));
  const threads = blob.threads.map((thread) =>
    normalizeThreadTimestamps(thread, { now, seed: seeds.get(thread.id) })
  );
  if (threads.every((thread, index) => thread === blob.threads[index])) {
    return blob as ChatBlob;
  }
  const migrated: ChatBlob = { ...blob, threads };
  await writeUserStore(STORE_KEYS.chat, userId, migrated);
  return migrated;
};

export const loadChat = async (userId: string): Promise<ChatBlob> => {
  const data = await readUserStore<ChatBlob | null>(
    STORE_KEYS.chat,
    userId,
    null
  );
  if (data && Array.isArray(data.threads)) {
    // An empty list is only a real state once the user has deleted friends;
    // otherwise treat it like a missing blob and seed.
    const deletedAny =
      Array.isArray(data.deletedThreadIds) && data.deletedThreadIds.length > 0;
    if (data.threads.length > 0 || deletedAny) {
      return withTimestamps(userId, data);
    }
  }
  const seeded: ChatBlob = { threads: seedThreads(), isPremium: false };
  await writeUserStore(STORE_KEYS.chat, userId, seeded);
  return seeded;
};

export const saveChat = async (userId: string, value: ChatBlob) =>
  writeUserStore(STORE_KEYS.chat, userId, value);

export const listChatThreads = async (userId: string) => {
  const blob = await loadChat(userId);
  return blob.threads;
};

export const getChatThread = async (userId: string, id: string) => {
  const blob = await loadChat(userId);
  return blob.threads.find((thread) => thread.id === id) ?? null;
};

export const upsertThread = async (
  userId: string,
  input: Partial<ChatThread> & { id?: string }
) => {
  const blob = await loadChat(userId);
  const id = input.id || nextId("thread");
  const existing = blob.threads.find((thread) => thread.id === id);
  const merged: ChatThread = {
    id,
    name: input.name ?? existing?.name ?? "",
    kind: input.kind === "human" || existing?.kind === "human" ? "human" : "bot",
    email: input.email ?? existing?.email,
    preview: input.preview ?? existing?.preview ?? "",
    lastActivityAt:
      input.lastActivityAt ?? existing?.lastActivityAt ?? Date.now(),
    pinned: input.pinned ?? existing?.pinned ?? false,
    listen: input.listen ?? existing?.listen ?? false,
    synced: input.synced ?? existing?.synced ?? false,
    unread: input.unread ?? existing?.unread,
    request: input.request ?? existing?.request ?? "none",
    gender: input.gender ?? existing?.gender,
    birthday: input.birthday ?? existing?.birthday,
    description: input.description ?? existing?.description,
    personality: input.personality ?? existing?.personality,
    messages:
      input.messages !== undefined ? input.messages : existing?.messages ?? [],
  };
  const threads = existing
    ? blob.threads.map((thread) => (thread.id === id ? merged : thread))
    : [merged, ...blob.threads];
  await saveChat(userId, { ...blob, threads });
  return merged;
};

export const appendMessage = async (
  userId: string,
  threadId: string,
  message: Omit<ChatBubble, "id" | "sentAt"> & { id?: string; sentAt?: number }
) => {
  const blob = await loadChat(userId);
  const sentAt =
    typeof message.sentAt === "number" && Number.isFinite(message.sentAt)
      ? message.sentAt
      : Date.now();
  const bubble: ChatBubble = {
    ...message,
    id: message.id || nextId("msg"),
    sentAt,
  };
  const existing = blob.threads.find((thread) => thread.id === threadId);
  const thread: ChatThread = existing
    ? {
        ...existing,
        preview: message.text,
        lastActivityAt: sentAt,
        messages: [...existing.messages, bubble],
      }
    : {
        id: threadId,
        name: threadId,
        kind: "bot",
        preview: message.text,
        lastActivityAt: sentAt,
        pinned: false,
        listen: false,
        synced: false,
        request: "none",
        messages: [bubble],
      };
  const threads = existing
    ? blob.threads.map((item) => (item.id === threadId ? thread : item))
    : [thread, ...blob.threads];
  await saveChat(userId, { ...blob, threads });
  return thread;
};

export const loadCompanions = async (userId: string): Promise<CompanionBlob> =>
  readUserStore<CompanionBlob>(STORE_KEYS.companions, userId, {
    companions: [],
    activeCompanionId: null,
  });

export const saveCompanions = async (userId: string, value: CompanionBlob) =>
  writeUserStore(STORE_KEYS.companions, userId, value);

export const upsertCompanionRow = async (userId: string, companion: any) => {
  const blob = await loadCompanions(userId);
  const id = companion.id || nextId("companion");
  const next = { ...companion, id };
  const index = blob.companions.findIndex((item) => item.id === id);
  const companions =
    index === -1
      ? [...blob.companions, next]
      : blob.companions.map((item, i) => (i === index ? { ...item, ...next } : item));
  const value = { companions, activeCompanionId: id };
  await saveCompanions(userId, value);
  return next;
};

export const loadSavedPatterns = async (userId: string) =>
  readUserStore<SavedPattern[]>(STORE_KEYS.patterns, userId, []);

export const saveSavedPatterns = async (
  userId: string,
  patterns: SavedPattern[]
) => writeUserStore(STORE_KEYS.patterns, userId, patterns);

export const upsertSavedPattern = async (
  userId: string,
  pattern: SavedPattern
) => {
  const current = await loadSavedPatterns(userId);
  const index = current.findIndex((item) => item.id === pattern.id);
  const next =
    index === -1
      ? [...current, pattern]
      : current.map((item, i) => (i === index ? pattern : item));
  await saveSavedPatterns(userId, next);
  return next;
};

export const loadSavedKinks = async (userId: string) =>
  readUserStore<SavedKink[]>(STORE_KEYS.kinks, userId, []);

export const saveSavedKinks = async (userId: string, kinks: SavedKink[]) =>
  writeUserStore(STORE_KEYS.kinks, userId, kinks);

export const upsertSavedKink = async (userId: string, kink: SavedKink) => {
  const current = await loadSavedKinks(userId);
  const index = current.findIndex((item) => item.id === kink.id);
  const next =
    index === -1
      ? [...current, kink]
      : current.map((item, i) => (i === index ? kink : item));
  await saveSavedKinks(userId, next);
  return next;
};

// Kink hub hearts: the ids of favorited cards (built-in titles such as
// "Hardcore" plus saved-kink ids). Stored separately from `SavedKink` rows
// because the built-in cards are not persisted rows themselves.
export const parseKinkFavorites = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) {
    return null;
  }
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0 && !ids.includes(item)) {
      ids.push(item);
    }
  }
  return ids;
};

export const loadKinkFavorites = async (
  userId: string,
  fallback: string[] = []
): Promise<string[]> => {
  const raw = await readUserStore<unknown>(
    STORE_KEYS.kinkFavorites,
    userId,
    null
  );
  return parseKinkFavorites(raw) ?? fallback;
};

export const saveKinkFavorites = async (userId: string, ids: string[]) =>
  writeUserStore(STORE_KEYS.kinkFavorites, userId, ids);

export const toggleKinkFavorite = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];

export const resetPasswordForEmail = async (
  email: string,
  newPassword: string
) => {
  await ensureSeeded();
  const users = await getUsers();
  const index = users.findIndex(
    (user) => user.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (index === -1) {
    return false;
  }
  users[index] = {
    ...users[index],
    passwordHash: hashPassword(newPassword),
  };
  await setUsers(users);
  return true;
};

export const loginAndSession = async (user: LocalUser) => {
  const session = publicUser(user);
  await writeSessionUser(session);
  await migrateLegacyStores(user.id);
  return session;
};
