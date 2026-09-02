import React from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { useWizardChrome } from "./chrome";
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
  StepNote,
  WizardShell,
  progressFor,
} from "./shared";

export const AvatarPersonalityScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft } = useAvatarWizard();
  const { mode, title, requestLeave, goBackStep, modal } = useWizardChrome();
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
      title={title}
      progressFill={progressFor(mode, "personality")}
      leftIcon="back"
      rightIcon="close"
      onLeftPress={goBackStep}
      onRightPress={requestLeave}
      primaryLabel="Continue"
      primaryDisabled={!canContinue}
      onPrimary={() => {
        if (!canContinue) {
          return;
        }
        navigation.navigate(SCREENS.AVATAR_INTIMATE);
      }}
    >
      {modal}
      <View style={styles.content}>
        <StepNote>These traits shape chat persona, not the 3D look.</StepNote>
        <FieldLabel>Personality</FieldLabel>
        <FieldHint>
          {`What traits set your heart aflame?\nChoose up to 3.`}
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
    paddingTop: s(24),
    alignItems: "center",
    gap: s(12),
  },
  options: {
    marginTop: s(24),
    gap: s(16),
    alignItems: "center",
  },
});
