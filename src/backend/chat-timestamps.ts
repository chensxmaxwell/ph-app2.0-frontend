import type { ChatBubble, ChatThread } from "../screens/chat/types";

// Chat blobs persisted before timestamps existed carry a display string
// (`time: "Now"`) and bubbles with no `sentAt`. This recovers real times
// wherever the data still encodes them and never leaves a bubble unstamped:
//
//   1. a stored numeric `sentAt` (already migrated) is kept as is
//   2. ids minted by the chat store look like `${Date.now()}-${hex}` and ids
//      from backend/store `nextId(prefix)` like `${prefix}-${base36 epoch}-${hex}`;
//      the epoch is read back out of the id
//   3. seeded bubbles (k1…a5) take the matching seed bubble's time, as long as
//      it does not reorder the thread around a real time recovered in 2
//   4. anything left copies its nearest recovered neighbour, then the
//      thread's own `lastActivityAt`, then the migration moment
//
// A bubble whose time was recovered in 1 or 2 is an anchor and is never moved.

const DAY_MS = 24 * 60 * 60_000;
const EARLIEST_PLAUSIBLE_EPOCH = Date.UTC(2020, 0, 1);

type StoredBubble = Omit<ChatBubble, "sentAt"> & { sentAt?: unknown };

export type StoredChatThread = Omit<
  ChatThread,
  "lastActivityAt" | "messages"
> & {
  lastActivityAt?: unknown;
  // The pre-timestamp display string ("Now", "Yesterday", "2:14 PM").
  time?: unknown;
  messages?: StoredBubble[];
};

const isEpoch = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const plausible = (candidate: number, now: number) =>
  Number.isFinite(candidate) &&
  candidate >= EARLIEST_PLAUSIBLE_EPOCH &&
  candidate <= now + DAY_MS;

export const sentAtFromId = (id: string, now: number): number | undefined => {
  const decimal = /^(\d{12,14})(?:-|$)/.exec(id);
  if (decimal) {
    const candidate = Number(decimal[1]);
    return plausible(candidate, now) ? candidate : undefined;
  }
  const base36 = /^[a-z]+-([0-9a-z]{7,9})-[0-9a-f]+$/i.exec(id);
  if (base36) {
    const candidate = parseInt(base36[1], 36);
    return plausible(candidate, now) ? candidate : undefined;
  }
  return undefined;
};

export const normalizeThreadTimestamps = (
  thread: StoredChatThread,
  options: { now: number; seed?: ChatThread }
): ChatThread => {
  const { now, seed } = options;
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const seedTimes = new Map(
    (seed?.messages ?? []).map((bubble) => [bubble.id, bubble.sentAt])
  );

  const anchors = messages.map((bubble) =>
    isEpoch(bubble.sentAt) ? bubble.sentAt : sentAtFromId(bubble.id, now)
  );
  const threadFallback = isEpoch(thread.lastActivityAt)
    ? thread.lastActivityAt
    : now;

  const resolved: number[] = [];
  messages.forEach((bubble, index) => {
    const anchor = anchors[index];
    if (anchor !== undefined) {
      resolved.push(anchor);
      return;
    }
    const before = index > 0 ? resolved[index - 1] : undefined;
    const after = anchors
      .slice(index + 1)
      .find((value): value is number => value !== undefined);
    const seedTime = seedTimes.get(bubble.id);
    if (
      seedTime !== undefined &&
      (before === undefined || seedTime >= before) &&
      (after === undefined || seedTime <= after)
    ) {
      resolved.push(seedTime);
      return;
    }
    resolved.push(before ?? after ?? threadFallback);
  });

  const lastActivityAt = isEpoch(thread.lastActivityAt)
    ? thread.lastActivityAt
    : resolved.length > 0
    ? Math.max(...resolved)
    : seed?.lastActivityAt ?? now;

  const unchanged =
    !("time" in thread) &&
    thread.lastActivityAt === lastActivityAt &&
    thread.messages === messages &&
    messages.every((bubble, index) => bubble.sentAt === resolved[index]);
  if (unchanged) {
    return thread as ChatThread;
  }

  const next: StoredChatThread = {
    ...thread,
    lastActivityAt,
    messages: messages.map((bubble, index) => ({
      ...bubble,
      sentAt: resolved[index],
    })),
  };
  delete next.time;
  return next as ChatThread;
};
