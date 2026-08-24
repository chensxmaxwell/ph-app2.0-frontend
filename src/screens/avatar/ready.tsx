import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import { useAvatarWizard } from "./context";
import { s } from "./scale";
import { WizardShell, useLeaveGuard } from "./shared";

export const AvatarReadyScreen = () => {
  const navigation = useNavigation();
  const { draft, resetDraft, isDirty } = useAvatarWizard();
  const { requestLeave, modal } = useLeaveGuard(isDirty, () => {
    resetDraft();
    navigation.getParent()?.goBack();
  });
  const displayName = draft.name.trim() || "them";

  return (
    <WizardShell
      title="Craft your ideal lover"
      progressFill={86}
      leftIcon="close"
      onLeftPress={requestLeave}
      primaryLabel="Let’s go"
      onPrimary={() => navigation.navigate(SCREENS.AVATAR_APPEARANCE)}
      secondaryLabel="Return"
      onSecondary={() => navigation.goBack()}
    >
      {modal}
      <View style={styles.center}>
        <Text style={styles.heading}>Ready to meet {displayName}?</Text>
        <Text style={styles.body}>
          Bring your partner to life visually. Design their appearance to match
          the love in your dreams.
        </Text>
      </View>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: s(80),
  },
  heading: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
    width: s(329),
  },
  body: {
    marginTop: s(15),
    width: s(329),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    lineHeight: 16.25,
    textAlign: "center",
  },
});
