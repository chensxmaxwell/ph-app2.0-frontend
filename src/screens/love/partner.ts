import type { ChatThread } from "../chat/types";
import type { Companion } from "../../store/companions";
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
  const companion = requestedId
    ? companions.find((item) => item.id === requestedId)
    : undefined;
  const thread = requestedId
    ? threads.find((item) => item.id === requestedId)
    : undefined;
  const fallbackCompanion = requestedId
    ? undefined
    : activeCompanion ?? undefined;
  const resolvedCompanion = companion ?? fallbackCompanion;
  const resolvedId = resolvedCompanion?.id ?? thread?.id ?? requestedId;
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
