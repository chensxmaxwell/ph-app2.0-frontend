import { useNavigation } from "@react-navigation/native";
import { useChat } from "../chat/store";
import { useCompanions } from "../../store/companions";
import { samePersonalities, useAvatarWizard } from "./context";
import { companionFromDraft } from "./persist";

export const useSaveCompanion = () => {
  const { draft, baseline, companionId, mode } = useAvatarWizard();
  const { companions, upsertCompanion } = useCompanions();
  const { updateBot, upsertCompanionThread } = useChat();

  return () => {
    const companion = companionFromDraft(companionId, draft);
    const hasCompanionRecord = companions.some(
      (item) => item.id === companionId
    );

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
      });
      return companion;
    }

    upsertCompanion(companion);
    upsertCompanionThread(companion);
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
