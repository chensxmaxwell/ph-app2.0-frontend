import { useNavigation } from "@react-navigation/native";
import { useChat } from "../chat/store";
import { useCompanions } from "../../store/companions";
import { useAvatarWizard } from "./context";
import { companionFromDraft } from "./persist";

export const useSaveCompanion = () => {
  const { draft, companionId } = useAvatarWizard();
  const { upsertCompanion } = useCompanions();
  const { upsertCompanionThread } = useChat();

  return () => {
    const companion = companionFromDraft(companionId, draft);
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
