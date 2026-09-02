import { LoveChatItem, LoveChatState, LoveLayer, LoveMode } from "./types";
import type { LoveStackSurface } from "./stack";

export const shouldReuseLoveChat = ({
  currentCompanionId,
  nextCompanionId,
  replace,
}: {
  currentCompanionId?: string;
  nextCompanionId?: string;
  replace?: boolean;
}) => {
  if (replace) {
    return false;
  }
  if (!nextCompanionId || !currentCompanionId) {
    return false;
  }
  return currentCompanionId === nextCompanionId;
};

export type LiveLoveSession = {
  companionId?: string;
  layer: LoveLayer | null;
  minimized: boolean;
  surface: LoveStackSurface;
  chat: LoveChatState | null;
  callStartedAt: number | null;
  syncStartedAt: number | null;
};

export const emptyLoveSession = (): LiveLoveSession => ({
  companionId: undefined,
  layer: null,
  minimized: false,
  surface: "love",
  chat: null,
  callStartedAt: null,
  syncStartedAt: null,
});

export const snapshotLoveSession = (
  live: LiveLoveSession
): LiveLoveSession | null => {
  if (!live.layer) {
    return null;
  }
  return {
    companionId: live.companionId,
    layer: live.layer,
    minimized: live.minimized,
    surface: live.surface,
    chat: live.chat,
    callStartedAt: live.callStartedAt,
    syncStartedAt: live.syncStartedAt,
  };
};

export const liveFromPersisted = (
  persisted: LiveLoveSession | null
): LiveLoveSession => {
  if (!persisted?.layer) {
    return emptyLoveSession();
  }
  return {
    companionId: persisted.companionId,
    layer: persisted.layer,
    minimized: true,
    surface: persisted.surface,
    chat: persisted.chat,
    callStartedAt: persisted.callStartedAt,
    syncStartedAt: persisted.syncStartedAt,
  };
};

export const showsSessionLovePill = (live: LiveLoveSession) =>
  Boolean(live.layer && live.minimized);

const isLoveLayer = (value: unknown): value is LoveLayer =>
  value === "chat" || value === "call" || value === "sync";

const isLoveStackSurface = (value: unknown): value is LoveStackSurface =>
  value === "love" || value === "message" || value === "control";

const isLoveMode = (value: unknown): value is LoveMode =>
  value === "none" || value === "pattern" || value === "kink" || value === "bliss";

const parseChatItem = (raw: unknown): LoveChatItem | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Record<string, unknown>;
  if (item.kind === "sync" && typeof item.id === "string") {
    return { kind: "sync", id: item.id };
  }
  if (
    item.kind === "bubble" &&
    typeof item.id === "string" &&
    (item.from === "them" || item.from === "me") &&
    typeof item.text === "string"
  ) {
    return {
      kind: "bubble",
      id: item.id,
      from: item.from,
      text: item.text,
      synced: typeof item.synced === "boolean" ? item.synced : undefined,
    };
  }
  return null;
};

const parseChat = (raw: unknown): LoveChatState | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.name !== "string" || !Array.isArray(value.messages)) {
    return null;
  }
  const messages = value.messages
    .map(parseChatItem)
    .filter((item): item is LoveChatItem => item !== null);
  return {
    companionId:
      typeof value.companionId === "string" ? value.companionId : undefined,
    name: value.name,
    personality:
      typeof value.personality === "string" ? value.personality : undefined,
    story: typeof value.story === "string" ? value.story : undefined,
    messages,
    synced: value.synced === true,
    inCall: value.inCall === true,
    listen: value.listen === true,
    pinned: value.pinned !== false,
    mode: isLoveMode(value.mode) ? value.mode : "none",
  };
};

const parseTimestamp = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const parsePersistedLoveSession = (
  raw: unknown
): LiveLoveSession | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (!isLoveLayer(value.layer)) {
    return null;
  }
  return {
    companionId:
      typeof value.companionId === "string" ? value.companionId : undefined,
    layer: value.layer,
    minimized: value.minimized === true,
    surface: isLoveStackSurface(value.surface) ? value.surface : "love",
    chat: parseChat(value.chat),
    callStartedAt: parseTimestamp(value.callStartedAt),
    syncStartedAt: parseTimestamp(value.syncStartedAt),
  };
};
