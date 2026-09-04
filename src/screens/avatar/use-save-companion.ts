import { useNavigation } from "@react-navigation/native";
import { voiceIdForGender } from "../../services/voices";
import { threadIdForCompanion } from "../chat/person";
import { useChat } from "../chat/store";
import { useCompanions } from "../../store/companions";
import { samePersonalities, useAvatarWizard } from "./context";
import { companionFromDraft } from "./persist";

export const useSaveCompanion = () => {
  const { draft, baseline, companionId, mode } = useAvatarWizard();
  const { companions, upsertCompanion } = useCompanions();
  const { threads, updateBot, upsertCompanionThread, setAvatar } = useChat();

  return () => {
    const drafted = companionFromDraft(companionId, draft);
    // A new companion named after a seeded bot (Kevin / Chad / Amanda) takes
    // that seed's id, so its record and the Message thread it folds into
    // share one id instead of pairing by name forever.
    const id = mode === "create" ? threadIdForCompanion(drafted) : drafted.id;
    const existingRecord = companions.find((item) => item.id === companionId);
    const existingThread = threads.find(
      (thread) => thread.id === id || thread.id === threadIdForCompanion(drafted)
    );
    // The voice is part of who this person is: a new character draws one at
    // random from their gender's pool; an edit keeps the stored voice unless
    // the gender changed and it no longer fits.
    const voiceId = voiceIdForGender(
      existingThread?.voiceId ?? existingRecord?.voiceId,
      drafted.gender
    );
    const companion = { ...drafted, id, voiceId };
    const hasCompanionRecord = existingRecord !== undefined;

    // Edit persona on a chat-only bot (seeded Kevin / Amanda, or a bot whose
    // avatar was never crafted): persona lives on the thread. Minting a
    // Companion here would swap its portrait for a default 3D face; the 3D
    // record is only ever created by the create wizard ("Create avatar").
    if (mode === "editPersona" && !hasCompanionRecord) {
      const personalityTouched = !samePersonalities(
        draft.personalities,
        baseline.personalities
      );
      updateBot(companionId, {
        name: companion.name,
        gender: companion.gender,
        birthday: companion.birthday,
        description: companion.story,
        personality: personalityTouched
          ? companion.personalities.join(", ")
          : undefined,
        voiceId,
      });
      if (draft.avatar) {
        setAvatar(companionId, draft.avatar);
      }
      return companion;
    }

    upsertCompanion(companion);
    upsertCompanionThread(companion);
    const threadId = threadIdForCompanion(companion);
    switch (mode) {
      case "create":
        // The Identity page's Choose avatar grid decided the face; the 3D
        // look is the fallback for drafts saved without a pick.
        setAvatar(threadId, draft.avatar ?? "look");
        break;
      case "editLook":
        // A look that was just re-crafted is the face until the user picks
        // another.
        setAvatar(threadId, "look");
        break;
      case "editPersona":
        if (draft.avatar) {
          setAvatar(threadId, draft.avatar);
        }
        break;
      default: {
        const exhaustive: never = mode;
        return exhaustive;
      }
    }
    return companion;
  };
};

export const useSaveAndExit = () => {
  const navigation = useNavigation();
  const save = useSaveCompanion();

  return () => {
    save();
    navigation.getParent()?.goBack();
  };
};
