import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import { useWizardChrome } from "./chrome";
import { useAvatarWizard } from "./context";
import { s } from "./scale";
import { FieldLabel, StepNote, WizardShell, progressFor } from "./shared";

const STORY_LIMIT = 3000;

export const AvatarStoryScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft } = useAvatarWizard();
  const { mode, title, requestLeave, goBackStep, modal } = useWizardChrome();
  const name = draft.name.trim() || "[name]";

  return (
    <WizardShell
      title={title}
      progressFill={progressFor(mode, "story")}
      leftIcon="back"
      rightIcon="close"
      onLeftPress={goBackStep}
      onRightPress={requestLeave}
      primaryLabel="Continue"
      onPrimary={() => navigation.navigate(SCREENS.AVATAR_INTIMATE)}
    >
      {modal}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.content}
      >
        <StepNote>Affects chat persona, not 3D.</StepNote>
        <FieldLabel>Their story</FieldLabel>
        <Text style={styles.hint}>
          Weave the tale of their life. Describe{" "}
          <Text style={styles.hintName}>{name}</Text>
          ’s experiences, passions, and the undeniable charm that make them
          unforgettable.
        </Text>
        <View style={styles.storyBox}>
          <TextInput
            value={draft.story}
            onChangeText={(story) =>
              patchDraft({ story: story.slice(0, STORY_LIMIT) })
            }
            placeholder={`${name}’s story`}
            placeholderTextColor={colors.grayLighter}
            style={styles.storyInput}
            multiline
            maxLength={STORY_LIMIT}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>
            {draft.story.length}/{STORY_LIMIT}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: s(80),
    alignItems: "center",
  },
  hint: {
    marginTop: s(15),
    width: s(329),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    lineHeight: 16.25,
    textAlign: "center",
  },
  hintName: {
    color: colors.white,
  },
  storyBox: {
    marginTop: s(24),
    width: s(329),
    height: s(160),
    borderRadius: s(20),
    backgroundColor: colors.grayLightest,
    paddingHorizontal: s(16),
    paddingTop: s(16),
    paddingBottom: s(12),
  },
  storyInput: {
    flex: 1,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    padding: 0,
  },
  counter: {
    alignSelf: "flex-end",
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});
