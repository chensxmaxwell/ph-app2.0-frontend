import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import ChevronDown from "@images/avatar/chevron-down.svg";
import {
  BIRTHDAY_HINT,
  BIRTHDAY_PLACEHOLDER,
  formatBirthdayInput,
  isPlausibleBirthday,
} from "./birthday";
import { useCompanions } from "../../store/companions";
import { threadIdForCompanion } from "../chat/person";
import { AvatarPicker } from "./avatar-picker";
import { useWizardChrome } from "./chrome";
import { GENDER_OPTIONS, GenderOption, useAvatarWizard } from "./context";
import { avatarOptions } from "./face";
import { companionFromDraft } from "./persist";
import { s } from "./scale";
import {
  FieldHint,
  FieldLabel,
  PillField,
  StepNote,
  WizardShell,
  progressFor,
} from "./shared";

export const DESCRIPTION_LIMIT = 3000;

export const GENDER_NOTE = "3D appearance is the current body for every gender.";

// Basic info for a companion: the single form behind Home `+`, Message `+` →
// Create new, and every Edit persona entry. Description is the same field the
// chat persona reads as `story`. The Choose avatar grid lives here too, so the
// face is picked while the person is being made (TestFlight 1.2 (13): nobody
// found the picker hidden behind Chat settings).
export const AvatarIdentityScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft, mode, companionId } = useAvatarWizard();
  const { title, requestLeave, goBackStep, modal } = useWizardChrome();
  const { companions } = useCompanions();
  const [nameFocused, setNameFocused] = useState(true);
  const [genderOpen, setGenderOpen] = useState(false);
  const birthdayLooksInvalid = !isPlausibleBirthday(draft.birthday);
  // Creating requires a face; editing opens with the current one selected.
  const needsAvatar = mode === "create" && draft.avatar === null;
  const canContinue =
    draft.name.trim().length > 0 && !birthdayLooksInvalid && !needsAvatar;
  const name = draft.name.trim() || "[name]";
  // The 3D look is on offer when it is about to be crafted (create) or already
  // exists (a companion record); a chat-only bot has no look to pick.
  const hasLook =
    mode === "create" || companions.some((item) => item.id === companionId);
  const drafted = companionFromDraft(companionId, draft);
  const options = avatarOptions({
    id: threadIdForCompanion(drafted),
    companion: hasLook ? drafted : undefined,
    gender: draft.gender,
    choice: draft.avatar ?? undefined,
  });

  return (
    <WizardShell
      title={title}
      progressFill={progressFor(mode, "identity")}
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
        if (mode === "editPersona") {
          navigation.navigate(SCREENS.AVATAR_PERSONALITY);
          return;
        }
        navigation.navigate(SCREENS.AVATAR_READY);
      }}
    >
      {modal}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepNote>
            Name, gender, avatar, birthday, and description for this person.
            The 3D body is the same for every gender.
          </StepNote>
          <FieldLabel>Name</FieldLabel>
          <FieldHint>
            Whisper their name into existence, a name that will echo through
            your heart’s most tender moments.
          </FieldHint>
          <PillField focused={nameFocused}>
            <TextInput
              testID="identity-name"
              value={draft.name}
              onChangeText={(next) => patchDraft({ name: next })}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder="Kevin"
              placeholderTextColor={colors.grayLighter}
              style={styles.input}
            />
          </PillField>

          <View style={styles.section}>
            <FieldLabel>Gender</FieldLabel>
            <View style={styles.fieldGap} />
            <TouchableOpacity
              testID="identity-gender"
              activeOpacity={0.85}
              onPress={() => setGenderOpen((open) => !open)}
            >
              <PillField focused={Boolean(draft.gender) || genderOpen}>
                <View style={styles.genderRow}>
                  <Text
                    style={[
                      styles.input,
                      styles.genderInput,
                      draft.gender
                        ? styles.genderValue
                        : styles.genderPlaceholder,
                    ]}
                  >
                    {draft.gender || "Select"}
                  </Text>
                  <View style={styles.genderChevron}>
                    <ChevronDown width={s(35)} height={s(35)} />
                  </View>
                </View>
              </PillField>
            </TouchableOpacity>
            {genderOpen
              ? GENDER_OPTIONS.map((option) => {
                  const selected = draft.gender === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      testID={`identity-gender-${option}`}
                      disabled={false}
                      style={[
                        styles.genderOption,
                        selected && styles.genderOptionSelected,
                      ]}
                      onPress={() => {
                        patchDraft({ gender: option as GenderOption });
                        setGenderOpen(false);
                      }}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                    </TouchableOpacity>
                  );
                })
              : null}
            <Text style={styles.genderNote}>{GENDER_NOTE}</Text>
          </View>

          <View style={styles.section}>
            <FieldLabel>Choose avatar</FieldLabel>
            <FieldHint>
              {mode === "create"
                ? `The face ${name} shows on Home and in chat: the 3D avatar you are about to craft, or a portrait.`
                : `The face ${name} shows on Home and in chat.`}
            </FieldHint>
            <View style={styles.avatarGrid}>
              <AvatarPicker
                options={options}
                selected={draft.avatar}
                onSelect={(choice) => patchDraft({ avatar: choice })}
              />
            </View>
          </View>

          <View style={styles.section}>
            <FieldLabel>Birthday</FieldLabel>
            <View style={styles.fieldGap} />
            <PillField>
              <TextInput
                testID="identity-birthday"
                value={draft.birthday}
                onChangeText={(birthday) =>
                  patchDraft({
                    birthday: formatBirthdayInput(birthday, draft.birthday),
                  })
                }
                placeholder={BIRTHDAY_PLACEHOLDER}
                placeholderTextColor={colors.grayLighter}
                style={styles.input}
                keyboardType="numbers-and-punctuation"
              />
            </PillField>
            {birthdayLooksInvalid ? (
              <Text style={styles.birthdayHint}>{BIRTHDAY_HINT}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <FieldLabel>Description</FieldLabel>
            <Text style={styles.descriptionHint}>
              Weave the tale of their life. Describe{" "}
              <Text style={styles.descriptionHintName}>{name}</Text>
              ’s experiences, passions, and the undeniable charm that make them
              unforgettable.
            </Text>
            <View style={styles.descriptionBox}>
              <TextInput
                testID="identity-description"
                value={draft.story}
                onChangeText={(story) =>
                  patchDraft({ story: story.slice(0, DESCRIPTION_LIMIT) })
                }
                placeholder="Add description of your character here."
                placeholderTextColor={colors.grayLighter}
                style={styles.descriptionInput}
                multiline
                maxLength={DESCRIPTION_LIMIT}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {draft.story.length}/{DESCRIPTION_LIMIT}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: s(24),
    paddingBottom: s(24),
    alignItems: "center",
    gap: s(12),
  },
  section: {
    marginTop: s(28),
    alignItems: "center",
    width: "100%",
  },
  fieldGap: {
    height: s(12),
  },
  birthdayHint: {
    marginTop: s(8),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  input: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    padding: 0,
    width: "100%",
  },
  genderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  genderInput: {
    flex: 1,
    width: "auto",
  },
  genderChevron: {
    flexShrink: 0,
    width: s(35),
    height: s(35),
    marginLeft: s(8),
  },
  genderValue: {
    color: colors.white,
  },
  genderPlaceholder: {
    color: colors.grayLighter,
  },
  genderOption: {
    width: s(329),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: colors.grayLightest,
    marginTop: s(8),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  genderOptionSelected: {
    backgroundColor: colors.grayLighter,
    borderColor: colors.white,
  },
  genderOptionText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  avatarGrid: {
    marginTop: s(16),
    width: s(329),
  },
  genderNote: {
    marginTop: s(10),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
    width: s(329),
  },
  descriptionHint: {
    marginTop: s(12),
    width: s(329),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    lineHeight: 16.25,
    textAlign: "center",
  },
  descriptionHintName: {
    color: colors.white,
  },
  descriptionBox: {
    marginTop: s(16),
    width: s(329),
    height: s(160),
    borderRadius: s(20),
    backgroundColor: colors.grayLightest,
    paddingHorizontal: s(16),
    paddingTop: s(16),
    paddingBottom: s(12),
  },
  descriptionInput: {
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
