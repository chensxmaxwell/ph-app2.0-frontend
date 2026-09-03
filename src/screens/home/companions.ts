import { useMemo } from "react";
import type { AvatarLook } from "../avatar/engine/viewer-html";
import {
  Companion,
  lookFromCompanion,
  useCompanions,
} from "../../store/companions";
import { messageFriends } from "../chat/friends";
import { defaultBotIdForName, useChat } from "../chat/store";
import type { ChatKind, ChatThread } from "../chat/types";

export type HomeCompanion = {
  // The Message thread id; tapping the face opens that thread.
  id: string;
  name: string;
  kind: ChatKind;
  // The crafted 3D look when this person has a companion record, otherwise
  // null and Home falls back to the stock portrait for the id.
  look: AvatarLook | null;
};

// A created companion's thread normally shares its id. The chat store folds a
// companion named after a seeded bot (Kevin / Chad / Amanda) into that seed's
// thread instead, so pair by the same canonical-name rule as a fallback.
const companionForThread = (thread: ChatThread, companions: Companion[]) =>
  companions.find((companion) => companion.id === thread.id) ??
  companions.find(
    (companion) => defaultBotIdForName(companion.name) === thread.id
  );

// Home "My Companions" is the Message friends list: membership and order come
// from the chat threads (so a deleted friend, and a seed kept deleted by its
// tombstone, is gone here too), and the companions store only supplies the
// 3D look. There is no separate Home catalog to fall out of sync.
export const homeCompanions = (
  threads: ChatThread[],
  companions: Companion[]
): HomeCompanion[] =>
  messageFriends(threads).map((thread) => {
    const companion = companionForThread(thread, companions);
    return {
      id: thread.id,
      name: thread.name,
      kind: thread.kind,
      look: companion ? lookFromCompanion(companion) : null,
    };
  });

export const useHomeCompanions = (): HomeCompanion[] => {
  const { threads } = useChat();
  const { companions } = useCompanions();
  return useMemo(
    () => homeCompanions(threads, companions),
    [companions, threads]
  );
};
