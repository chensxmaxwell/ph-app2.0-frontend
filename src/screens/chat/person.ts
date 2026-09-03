import type { Companion } from "../../store/companions";
import type { ChatThread } from "./types";

// One person = one Message thread (the membership record every screen lists)
// plus, once the avatar wizard has run for them, one 3D companion record. The
// two are keyed by the same id except for the seeded-name fold below, so every
// lookup that starts from either id must go through this module instead of a
// bare `find(item => item.id === id)`; TestFlight 1.2 (12) drew a 3D Kevin on
// Home and the stock photo in his own chat because the chat surfaces did not.

const DEFAULT_BOT_IDS: Record<string, string> = {
  kevin: "kevin",
  chad: "chad",
  amanda: "amanda",
};

// A bot named after a seeded person shares that seed's thread id; the chat
// store folds such threads together (`findSameBot`, `dedupeThreads`).
export const defaultBotIdForName = (name?: string) =>
  DEFAULT_BOT_IDS[(name ?? "").trim().toLowerCase()];

// The Message thread a companion record belongs to: its own id, unless it is
// named after a seeded bot, in which case it folds into that seed's thread.
export const threadIdForCompanion = (companion: { id: string; name: string }) =>
  defaultBotIdForName(companion.name) ?? companion.id;

export const companionForThread = (
  thread: ChatThread,
  companions: Companion[]
): Companion | undefined =>
  companions.find((companion) => companion.id === thread.id) ??
  companions.find(
    (companion) => threadIdForCompanion(companion) === thread.id
  );

export const threadForCompanion = (
  companion: Companion,
  threads: ChatThread[]
): ChatThread | undefined =>
  threads.find((thread) => thread.id === companion.id) ??
  threads.find((thread) => thread.id === threadIdForCompanion(companion));

export type Person = {
  // The thread id when the person has a thread (the one membership id),
  // otherwise the companion record id.
  id: string;
  thread?: ChatThread;
  companion?: Companion;
};

// Resolve a thread id or a companion record id to the whole person.
export const findPerson = (
  id: string | undefined,
  threads: ChatThread[],
  companions: Companion[]
): Person | undefined => {
  const requested = id?.trim();
  if (!requested) {
    return undefined;
  }
  const threadById = threads.find((thread) => thread.id === requested);
  const companionById = companions.find(
    (companion) => companion.id === requested
  );
  const companion =
    companionById ??
    (threadById ? companionForThread(threadById, companions) : undefined);
  const thread =
    threadById ??
    (companionById ? threadForCompanion(companionById, threads) : undefined);
  if (!thread && !companion) {
    return undefined;
  }
  return { id: thread?.id ?? companion?.id ?? requested, thread, companion };
};
