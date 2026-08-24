import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import Candle from "@images/avatar/candle.svg";
import Flame from "@images/avatar/flame.svg";
import { useAvatarWizard } from "./context";
import { s } from "./scale";
import { WizardShell, useLeaveGuard, wizardProgressFill } from "./shared";

export const AvatarCandleScreen = () => {
  const navigation = useNavigation();
  const { draft, resetDraft, isDirty } = useAvatarWizard();
  const { requestLeave, modal } = useLeaveGuard(isDirty, () => {
    resetDraft();
    navigation.getParent()?.goBack();
  });
  const name = draft.name.trim() || "[Name]";

  return (
    <WizardShell
      title="Craft your ideal lover"
      progressFill={wizardProgressFill(8)}
      leftIcon="close"
      onLeftPress={requestLeave}
      primaryLabel="Blow the candle"
      onPrimary={() => navigation.navigate(SCREENS.AVATAR_WAITING)}
      secondaryLabel="Return"
      onSecondary={() => navigation.goBack()}
    >
      {modal}
      <View style={styles.content}>
        <Text style={styles.heading}>{name} is here to meet you</Text>
        <Text style={styles.body}>
          Blow the candle to save {name} and open chat. This is a send-off —
          look and persona are already set.
        </Text>
        <View style={styles.candle}>
          <View style={styles.flame}>
            <Flame width={s(62)} height={s(94)} />
          </View>
          <Candle width={s(121)} height={s(143)} />
        </View>
      </View>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: s(66),
    alignItems: "center",
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
  candle: {
    marginTop: s(110),
    alignItems: "center",
  },
  flame: {
    marginBottom: s(-48),
    zIndex: 1,
  },
});
