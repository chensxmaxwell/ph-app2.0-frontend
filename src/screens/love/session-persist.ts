import { STORE_KEYS, getCurrentUserId } from "../../backend/session";
import { readUserStore, writeUserStore } from "../../backend/store";
import {
  LiveLoveSession,
  emptyLoveSession,
  liveFromPersisted,
  parsePersistedLoveSession,
  snapshotLoveSession,
} from "./session-logic";

export const loadLoveSessionForUser = async (userId: string) => {
  const raw = await readUserStore<unknown>(
    STORE_KEYS.loveSession,
    userId,
    null
  );
  return parsePersistedLoveSession(raw);
};

export const saveLoveSessionForUser = async (
  userId: string,
  live: LiveLoveSession
) => {
  await writeUserStore(
    STORE_KEYS.loveSession,
    userId,
    snapshotLoveSession(live)
  );
};

export type LoveSessionBoot = {
  userId: string | null;
  live: LiveLoveSession;
};

let boot: LoveSessionBoot | null = null;

export const prepareLoveSessionBoot = async (
  userId: string | null
): Promise<LoveSessionBoot> => {
  if (!userId) {
    boot = { userId: null, live: emptyLoveSession() };
    return boot;
  }
  const parsed = await loadLoveSessionForUser(userId);
  boot = { userId, live: liveFromPersisted(parsed) };
  return boot;
};

export const peekLoveSessionBoot = () => boot;

export const clearLoveSessionBoot = () => {
  boot = null;
};

export const initialLoveSessionFromBoot = (): LoveSessionBoot & {
  ready: boolean;
} => {
  const userId = getCurrentUserId();
  if (boot && boot.userId === userId) {
    return { ...boot, ready: true };
  }
  return { userId, live: emptyLoveSession(), ready: false };
};
