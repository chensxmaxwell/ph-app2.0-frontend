import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SimplePage } from "../shared/simple-page";

const SLIDES = [
  {
    title: "Companions",
    body: "Create a companion, then open Love from the floating pill on Home, Control, or Sync.",
  },
  {
    title: "Control",
    body: "Use Auto, Pattern, Manual, Kink, Playground, and Sync to play with your device.",
  },
  {
    title: "Message",
    body: "Chat with bots and friends. Listen reads messages out loud. Voice call is audio only.",
  },
];

export const TutorialScreen = () => {
  const navigation = useNavigation();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <SimplePage
      title="Tutorial"
      onBack={() => navigation.goBack()}
      primaryLabel={last ? "Done" : "Next"}
      onPrimary={() => {
        if (last) {
          navigation.goBack();
          return;
        }
        setIndex((current) => current + 1);
      }}
      secondaryLabel={last ? undefined : "Skip"}
      onSecondary={() => navigation.goBack()}
    >
      <View style={styles.center}>
        <Text style={styles.kicker}>
          {index + 1} / {SLIDES.length}
        </Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  kicker: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  title: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 24,
    textAlign: "center",
  },
  body: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});
