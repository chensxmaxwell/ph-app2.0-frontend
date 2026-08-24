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
import { useAvatarWizard } from "./context";
import { s } from "./scale";
import { FieldLabel, WizardShell, useLeaveGuard, wizardProgressFill } from "./shared";

const STORY_LIMIT = 3000;

export const AvatarStoryScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft, resetDraft, isDirty } = useAvatarWizard();
  const { requestLeave, modal } = useLeaveGuard(isDirty, () => {
    resetDraft();
    navigation.getParent()?.goBack();
  });
  const name = draft.name.trim() || "[name]";

  return (
    <WizardShell
      title="Craft your ideal lover"
      progressFill={wizardProgressFill(6)}
      leftIcon="close"
      onLeftPress={requestLeave}
      primaryLabel="Continue"
      onPrimary={() => navigation.navigate(SCREENS.AVATAR_INTIMATE)}
      secondaryLabel="Return"
      onSecondary={() => navigation.goBack()}
    >
      {modal}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.content}
      >
        <FieldLabel>Their story</FieldLabel>
        <Text style={styles.hint}>
          Weave the tale of their life. Describe{" "}
          <Text style={styles.hintName}>{name}</Text>
          ’s experiences, passions, and the undeniable charm that make them
          unforgettable.
          {"\n"}Affects chat persona, not 3D.
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
    paddingTop: s(136),
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
