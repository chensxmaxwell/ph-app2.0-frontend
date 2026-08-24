import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { ConnectionPill } from "@common/components/connection-pill";
import { NavigationType } from "../../../App";
import { SimplePage } from "../shared/simple-page";

export type PairStep =
  | "band-app"
  | "band-power"
  | "toy-power"
  | "toy-match";

const COPY: Record<
  PairStep,
  { hint: string; body: string; next: string }
> = {
  "band-app": {
    hint: "Turn on Bluetooth so we can find your bracelet.",
    body: "Pair your bracelet via Bluetooth with our Pleasure House app",
    next: SCREENS.PAIR_BAND_POWER,
  },
  "band-power": {
    hint: "Keep your bracelet nearby while it wakes up.",
    body: "Press the side button to power on your bracelet",
    next: SCREENS.PAIR_TOY_POWER,
  },
  "toy-power": {
    hint: "Your toy should flash when it is ready to pair.",
    body: "Press and hold the button for 2 seconds to power on your toy until the light turns green",
    next: SCREENS.PAIR_TOY_MATCH,
  },
  "toy-match": {
    hint: "Hold the toy close to your phone.",
    body: "Tap the button to pair your toy",
    next: SCREENS.CONNECT_DEVICE,
  },
};

export const PairDeviceScreen = () => {
  const navigation = useNavigation<NavigationType>();
  const route = useRoute<RouteProp<{ params: { step?: PairStep } }, "params">>();
  const step: PairStep = route.params?.step ?? "band-app";
  const copy = COPY[step];

  const goMain = () => {
    const root = navigation.getParent() ?? navigation;
    root.reset({
      index: 0,
      routes: [{ name: SCREENS.MAIN }],
    });
  };

  const goNext = () => {
    if (step === "toy-match") {
      navigation.navigate(SCREENS.CONNECT_DEVICE as never, {
        fromOnboarding: true,
      } as never);
      return;
    }
    navigation.navigate(copy.next as never, { step: nextStep(step) } as never);
  };

  return (
    <SimplePage
      title="Set up your devices"
      onBack={() => navigation.goBack()}
      primaryLabel="Continue"
      onPrimary={goNext}
      secondaryLabel="Skip for now"
      onSecondary={goMain}
    >
      <Text style={styles.hint}>{copy.hint}</Text>
      <View style={styles.stage}>
        <ConnectionPill />
        <View style={styles.orb} />
      </View>
      <Text style={styles.body}>{copy.body}</Text>
    </SimplePage>
  );
};

const nextStep = (step: PairStep): PairStep => {
  switch (step) {
    case "band-app":
      return "band-power";
    case "band-power":
      return "toy-power";
    case "toy-power":
      return "toy-match";
    case "toy-match":
      return "toy-match";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};

const styles = StyleSheet.create({
  hint: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  orb: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(204, 160, 221, 0.35)",
    borderWidth: 2,
    borderColor: "rgba(243, 243, 243, 0.4)",
  },
  body: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 26,
  },
});
