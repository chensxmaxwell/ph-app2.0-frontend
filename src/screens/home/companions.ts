import { useMemo } from "react";
import { Companion, useCompanions } from "../../store/companions";
import { CompanionFace, companionFace } from "../avatar/face";
import { messageFriends } from "../chat/friends";
import { companionForThread } from "../chat/person";
import { useChat } from "../chat/store";
import type { ChatKind, ChatThread } from "../chat/types";

export type HomeCompanion = {
  // The Message thread id; tapping the face opens that thread.
  id: string;
  name: string;
  kind: ChatKind;
  // The one face this person shows everywhere: the crafted 3D look when they
  // have a companion record (unless the user picked the photo), else the
  // stock portrait for the id.
  face: CompanionFace;
};

// Home "My Companions" is the Message friends list: membership and order come
// from the chat threads (so a deleted friend, and a seed kept deleted by its
// tombstone, is gone here too), and the companions store only supplies the
// 3D look. There is no separate Home catalog to fall out of sync.
export const homeCompanions = (
  threads: ChatThread[],
  companions: Companion[]
): HomeCompanion[] =>
  messageFriends(threads).map((thread) => ({
    id: thread.id,
    name: thread.name,
    kind: thread.kind,
    face: companionFace({
      thread,
      companion: companionForThread(thread, companions),
    }),
  }));

export const useHomeCompanions = (): HomeCompanion[] => {
  const { threads } = useChat();
  const { companions } = useCompanions();
  return useMemo(
    () => homeCompanions(threads, companions),
    [companions, threads]
  );
};
