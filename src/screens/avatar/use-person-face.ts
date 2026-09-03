import { useCallback, useMemo } from "react";
import { useCompanions } from "../../store/companions";
import { findPerson } from "../chat/person";
import { useChat } from "../chat/store";
import type { AvatarChoice, ChatKind } from "../chat/types";
import {
  AvatarOption,
  CompanionFace,
  avatarOptions,
  companionFace,
} from "./face";

export type PersonFace = {
  // Thread id when the person has a thread, else the companion record id.
  personId?: string;
  face: CompanionFace;
  options: AvatarOption[];
  // Set when the person has a thread to remember the pick on.
  choose?: (choice: AvatarChoice) => void;
};

// Resolves any thread id or companion record id to the face that person shows
// everywhere. Screens that list many people call this once and apply the
// returned function per row.
export const useFaceResolver = () => {
  const { threads } = useChat();
  const { companions } = useCompanions();
  return useCallback(
    (id?: string, kind?: ChatKind): CompanionFace => {
      const person = findPerson(id, threads, companions);
      return companionFace({
        id,
        kind,
        thread: person?.thread,
        companion: person?.companion,
      });
    },
    [companions, threads]
  );
};

export const usePersonFace = (id?: string, kind?: ChatKind): PersonFace => {
  const { threads, setAvatar } = useChat();
  const { companions } = useCompanions();
  return useMemo(() => {
    const person = findPerson(id, threads, companions);
    const input = {
      id,
      kind,
      thread: person?.thread,
      companion: person?.companion,
    };
    const threadId = person?.thread?.id;
    return {
      personId: person?.id ?? id,
      face: companionFace(input),
      options: avatarOptions(input),
      choose: threadId
        ? (choice: AvatarChoice) => setAvatar(threadId, choice)
        : undefined,
    };
  }, [companions, id, kind, setAvatar, threads]);
};
