import React from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import {
  PERSONALITY_OPTIONS,
  PersonalityOption,
  useAvatarWizard,
} from "./context";
import { s } from "./scale";
import {
  FieldHint,
  FieldLabel,
  OptionPill,
  WizardShell,
  useLeaveGuard,
  wizardProgressFill,
} from "./shared";

export const AvatarPersonalityScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft, resetDraft, isDirty } = useAvatarWizard();
  const { requestLeave, modal } = useLeaveGuard(isDirty, () => {
    resetDraft();
    navigation.getParent()?.goBack();
  });
  const canContinue = draft.personalities.length >= 1;

  const toggleTrait = (option: PersonalityOption) => {
    const selected = draft.personalities.includes(option);
    if (selected) {
      patchDraft({
        personalities: draft.personalities.filter((item) => item !== option),
      });
      return;
    }
    if (draft.personalities.length >= 3) {
      return;
    }
    patchDraft({ personalities: [...draft.personalities, option] });
  };

  return (
    <WizardShell
      title="Craft your ideal lover"
      progressFill={wizardProgressFill(5)}
      leftIcon="close"
      onLeftPress={requestLeave}
      primaryLabel="Continue"
      primaryDisabled={!canContinue}
      onPrimary={() => {
        if (!canContinue) {
          return;
        }
        navigation.navigate(SCREENS.AVATAR_STORY);
      }}
      secondaryLabel="Return"
      onSecondary={() => navigation.goBack()}
    >
      {modal}
      <View style={styles.content}>
        <FieldLabel>Personality</FieldLabel>
        <FieldHint>
          {`What traits set your heart aflame?\nChoose up to 3. These shape chat persona, not the 3D look.`}
        </FieldHint>
        <View style={styles.options}>
          {PERSONALITY_OPTIONS.map((option) => (
            <OptionPill
              key={option}
              title={option}
              selected={draft.personalities.includes(option)}
              onPress={() => toggleTrait(option)}
            />
          ))}
        </View>
      </View>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: s(40),
    alignItems: "center",
    gap: s(12),
  },
  options: {
    marginTop: s(24),
    gap: s(16),
    alignItems: "center",
  },
});
