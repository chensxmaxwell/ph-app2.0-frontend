import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import Candle from "@images/avatar/candle.svg";
import Flame from "@images/avatar/flame.svg";
import { useWizardChrome } from "./chrome";
import { useAvatarWizard } from "./context";
import { s } from "./scale";
import { StepNote, WizardShell, progressFor } from "./shared";

export const AvatarCandleScreen = () => {
  const navigation = useNavigation();
  const { draft } = useAvatarWizard();
  const { mode, title, requestLeave, goBackStep, modal } = useWizardChrome();
  const name = draft.name.trim() || "[Name]";

  return (
    <WizardShell
      title={title}
      progressFill={progressFor(mode, "candle")}
      leftIcon="back"
      rightIcon="close"
      onLeftPress={goBackStep}
      onRightPress={requestLeave}
      primaryLabel="Blow the candle"
      onPrimary={() => navigation.navigate(SCREENS.AVATAR_WAITING)}
    >
      {modal}
      <View style={styles.content}>
        <StepNote>
          A send-off only. Look and persona are already set and will be saved
          next.
        </StepNote>
        <Text style={styles.heading}>{name} is here to meet you</Text>
        <Text style={styles.body}>
          Blow the candle to save {name} and open chat.
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
    paddingTop: s(40),
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
