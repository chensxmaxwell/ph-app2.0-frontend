import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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
import { formatBirthdayInput } from "./birthday";
import { useWizardChrome } from "./chrome";
import { GENDER_OPTIONS, GenderOption, useAvatarWizard } from "./context";
import { s } from "./scale";
import {
  FieldHint,
  FieldLabel,
  PillField,
  StepNote,
  WizardShell,
  progressFor,
} from "./shared";

const isPlausibleBirthday = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    return false;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

export const AvatarIdentityScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft } = useAvatarWizard();
  const { mode, title, requestLeave, goBackStep, modal } = useWizardChrome();
  const [nameFocused, setNameFocused] = useState(true);
  const [genderOpen, setGenderOpen] = useState(false);
  const birthdayLooksInvalid = !isPlausibleBirthday(draft.birthday);
  const canContinue = draft.name.trim().length > 0 && !birthdayLooksInvalid;

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
        style={styles.content}
      >
        <StepNote>
          Name, birthday, and gender for this person. Gender does not change the
          3D model — demo is male-only.
        </StepNote>
        <FieldLabel>Name</FieldLabel>
        <FieldHint>
          Whisper their name into existence, a name that will echo through your
          heart’s most tender moments.
        </FieldHint>
        <PillField focused={nameFocused}>
          <TextInput
            value={draft.name}
            onChangeText={(name) => patchDraft({ name })}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="Kevin"
            placeholderTextColor={colors.grayLighter}
            style={styles.input}
          />
        </PillField>

        <View style={styles.section}>
          <FieldLabel>Birthday</FieldLabel>
          <View style={styles.fieldGap} />
          <PillField>
            <TextInput
              value={draft.birthday}
              onChangeText={(birthday) =>
                patchDraft({
                  birthday: formatBirthdayInput(birthday, draft.birthday),
                })
              }
              placeholder="mm/dd/yyyy"
              placeholderTextColor={colors.grayLighter}
              style={styles.input}
              keyboardType="numbers-and-punctuation"
            />
          </PillField>
          {birthdayLooksInvalid ? (
            <Text style={styles.birthdayHint}>Use mm/dd/yyyy</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <FieldLabel>Gender</FieldLabel>
          <View style={styles.fieldGap} />
          <TouchableOpacity
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
                const available = option === "Male";
                const selected = draft.gender === option;
                return (
                  <TouchableOpacity
                    key={option}
                    disabled={!available}
                    style={[
                      styles.genderOption,
                      selected && styles.genderOptionSelected,
                      !available && styles.genderOptionDisabled,
                    ]}
                    onPress={() => {
                      if (!available) {
                        return;
                      }
                      patchDraft({ gender: option as GenderOption });
                      setGenderOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.genderOptionText,
                        !available && styles.genderOptionTextDisabled,
                      ]}
                    >
                      {available ? option : `${option} · unavailable`}
                    </Text>
                  </TouchableOpacity>
                );
              })
            : null}
          <Text style={styles.genderNote}>Demo: male avatar only for now</Text>
        </View>
      </KeyboardAvoidingView>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: s(24),
    alignItems: "center",
    gap: s(12),
  },
  section: {
    marginTop: s(40),
    alignItems: "center",
    width: "100%",
  },
  fieldGap: {
    height: s(24),
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
  genderOptionDisabled: {
    opacity: 0.42,
  },
  genderOptionText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  genderOptionTextDisabled: {
    color: colors.grayLighter,
  },
  genderNote: {
    marginTop: s(10),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
    width: s(329),
  },
});
