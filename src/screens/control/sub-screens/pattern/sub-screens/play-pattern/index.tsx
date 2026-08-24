import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { FULL_SIZE } from "@common/constant";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { BaseText } from "@common/components/base-text";
import { spacings } from "@common/styles/spacings";
import { BackButton } from "@common/components/back-button";
import Lightbulb from "@images/icons/lightbulb.svg";
import { ConnectionPill } from "@common/components/connection-pill";
import PlayButton from "@images/arrowtriangle-right.svg";
import PauseButton from "@images/pause.svg";
import NextPattern from "@images/icons/forward-frame.svg";
import PrevPattern from "@images/icons/backward-frame.svg";

import { usePlayPattern } from "./hooks";
import { VibrationGraph, PatternType } from "../vibration-graph";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HomeStackScreenProps } from "../../../../../../../navigations/home-stack";
import { useEffect } from "react";
import { useHomeScreen } from "../../../../../../hooks/HomeScreenContext";

type PlayPatternScreenProps = NativeStackScreenProps<
  HomeStackScreenProps,
  "DisplayPattern"
>;

export const PlayPattern: React.FC<PlayPatternScreenProps> = ({ route }) => {
  const { pattern, title } = route.params;
  const { start, current, handlePlayButtonPress, handlePatternNavigate } =
    usePlayPattern({ pattern, title });
  const { setCurrentMode } = useHomeScreen();

  useEffect(() => {
    setCurrentMode(start ? "pattern" : "");
    return () => setCurrentMode("");
  }, [setCurrentMode, start]);

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <BackButton />
          <BaseText style={styles.titleText}>{current.title}</BaseText>
          <TouchableOpacity onPress={() => {}}>
            <Lightbulb />
          </TouchableOpacity>
        </View>
        <ConnectionPill />
        <View
          style={{
            display: "flex",
            flex: 1,
            justifyContent: "center",
            marginBottom: spacings.w100 + spacings.h36,
          }}
        >
          <VibrationGraph pattern={current.pattern} start={start} />
        </View>
        <View style={styles.buttomControl}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => handlePatternNavigate("prev")}
          >
            <PrevPattern />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handlePlayButtonPress()}
          >
            {start ? <PauseButton /> : <PlayButton />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => handlePatternNavigate("next")}
          >
            <NextPattern />
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export type DisplayPatternScreenProps = {
  pattern: PatternType;
  title: string;
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: "hidden",
    width: FULL_SIZE,
    display: "flex",
    alignItems: "center",
  },
  titleContainer: {
    width: FULL_SIZE,
    paddingHorizontal: spacings.w16,
    paddingTop: spacings.h16,
    paddingBottom: spacings.h34,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleText: {
    color: colors.white,
    fontSize: fontSizes.large,
    fontWeight: fontWeights.bold,
  },
  buttomControl: {
    position: "absolute",
    bottom: spacings.h36,
    display: "flex",
    flexDirection: "row",
    width: spacings.w320,
    paddingHorizontal: spacings.w16,
    justifyContent: "space-between",
  },
  controlButton: {
    backgroundColor: colors.grayLightest,
    width: spacings.w100,
    height: spacings.w100,
    borderRadius: spacings.w100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  navButton: {
    // width: spacings.w100,
    // height: spacings.w100,
    borderRadius: spacings.w100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
});
