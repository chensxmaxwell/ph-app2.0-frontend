import { useNavigation } from "@react-navigation/native";
import { useAvatarWizard } from "./context";
import { useLeaveGuard } from "./shared";
import { WizardMode } from "./types";

export const wizardTitle = (mode: WizardMode, name: string) => {
  const trimmed = name.trim();
  switch (mode) {
    case "create":
      return "Craft your ideal lover";
    case "editLook":
      return trimmed || "Edit look";
    case "editPersona":
      return trimmed || "Edit persona";
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
};

export const useWizardChrome = () => {
  const navigation = useNavigation();
  const { draft, mode, isDirty, restoreBaseline } = useAvatarWizard();
  const { requestLeave, modal } = useLeaveGuard(isDirty, () => {
    restoreBaseline();
    navigation.getParent()?.goBack();
  });

  const goBackStep = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    requestLeave();
  };

  return {
    draft,
    mode,
    title: wizardTitle(mode, draft.name),
    requestLeave,
    goBackStep,
    modal,
  };
};
