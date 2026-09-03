import type { ChatThread } from "../chat/types";
import type { Companion } from "../../store/companions";
import { findPerson, threadForCompanion } from "../chat/person";
import type { LoveChatItem } from "./types";

export type LovePersonParams = {
  companionId?: string;
  name?: string;
  fromCreation?: boolean;
  syncing?: boolean;
  fromMessage?: boolean;
};

export type LovePerson = {
  companion?: Companion;
  thread?: ChatThread;
  companionId?: string;
  name: string;
  personality?: string;
  story?: string;
};

// The person behind a Love overlay, from whichever id the caller has: the
// Message thread id (Home strip, Message Sync, pill restore) or the 3D
// companion record id (avatar wizard, active companion). A companion named
// after a seeded bot has a record id that differs from its thread id, so the
// two are paired through findPerson rather than a bare id match — otherwise a
// crafted Kevin opened from his thread lost his look, and opened from his
// record lost his messages.
export const resolveLovePerson = ({
  companionId,
  name,
  companions,
  threads = [],
  activeCompanion,
  chatName,
}: {
  companionId?: string;
  name?: string;
  companions: Companion[];
  threads?: ChatThread[];
  activeCompanion: Companion | null;
  chatName?: string;
}): LovePerson => {
  const requestedId = companionId?.trim();
  const person = requestedId
    ? findPerson(requestedId, threads, companions)
    : undefined;
  const fallbackCompanion = requestedId
    ? undefined
    : activeCompanion ?? undefined;
  const resolvedCompanion = person?.companion ?? fallbackCompanion;
  const thread =
    person?.thread ??
    (fallbackCompanion
      ? threadForCompanion(fallbackCompanion, threads)
      : undefined);
  // The thread id is the one membership id (what Home, Message and the Love
  // stack routes key on); the record id only stands in when there is no thread.
  const resolvedId = thread?.id ?? resolvedCompanion?.id ?? requestedId;
  const resolvedName =
    resolvedCompanion?.name ||
    thread?.name ||
    name?.trim() ||
    chatName?.trim() ||
    "Kevin";

  return {
    companion: resolvedCompanion,
    thread,
    companionId: resolvedId,
    name: resolvedName,
    personality:
      resolvedCompanion?.personalities?.join(", ") || thread?.personality,
    story: resolvedCompanion?.story || thread?.description,
  };
};

export const loveMessagesFromThread = (
  thread?: ChatThread
): LoveChatItem[] | undefined => {
  if (!thread?.messages.length) {
    return undefined;
  }
  return thread.messages.map((item) => ({
    kind: "bubble" as const,
    id: item.id,
    from: item.from,
    text: item.text,
    synced: item.synced,
  }));
};
