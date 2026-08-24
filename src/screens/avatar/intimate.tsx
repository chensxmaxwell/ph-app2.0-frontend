import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Slider } from "@miblanchard/react-native-slider";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import { useAvatarWizard } from "./context";
import { s } from "./scale";
import { FieldHint, FieldLabel, WizardShell, useLeaveGuard } from "./shared";

const SLIDERS = [
  {
    key: "passionateTender",
    left: "Passionate",
    right: "Tender",
  },
  {
    key: "dominantSubmissive",
    left: "Dominant",
    right: "Submissive",
  },
  {
    key: "experimentalVanilla",
    left: "Experimental",
    right: "Vanilla",
  },
] as const;

export const AvatarIntimateScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft, resetDraft, isDirty } = useAvatarWizard();
  const { requestLeave, modal } = useLeaveGuard(isDirty, () => {
    resetDraft();
    navigation.getParent()?.goBack();
  });

  return (
    <WizardShell
      title="Craft your ideal lover"
      progressFill={220}
      leftIcon="close"
      onLeftPress={requestLeave}
      primaryLabel="Continue"
      onPrimary={() => navigation.navigate(SCREENS.AVATAR_CANDLE)}
      secondaryLabel="Return"
      onSecondary={() => navigation.goBack()}
    >
      {modal}
      <View style={styles.content}>
        <FieldLabel>Intimate profile</FieldLabel>
        <FieldHint>
          What kind of connection do you yearn for? Shape the desires that will
          bind your souls in passion and tenderness.
        </FieldHint>
        <View style={styles.sliders}>
          {SLIDERS.map((slider) => (
            <View key={slider.key} style={styles.sliderBlock}>
              <Slider
                value={draft[slider.key]}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  patchDraft({ [slider.key]: next });
                }}
                minimumValue={0}
                maximumValue={1}
                minimumTrackTintColor={colors.accentLightPink}
                maximumTrackTintColor={colors.grayLightest}
                thumbTintColor={colors.white}
                trackStyle={styles.track}
                thumbStyle={styles.thumb}
              />
              <View style={styles.labels}>
                <Text style={styles.label}>{slider.left}</Text>
                <Text style={styles.label}>{slider.right}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: s(68),
    alignItems: "center",
  },
  sliders: {
    marginTop: s(48),
    width: s(328),
    gap: s(49),
  },
  sliderBlock: {
    width: s(328),
  },
  track: {
    height: s(10),
    borderRadius: s(20),
    backgroundColor: colors.grayLightest,
    shadowColor: colors.accentLightPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  thumb: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    backgroundColor: colors.white,
    shadowColor: colors.accentLightPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
  },
  labels: {
    marginTop: s(8),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});
