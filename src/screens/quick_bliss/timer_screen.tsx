import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { CountdownCircleTimer } from "react-native-countdown-circle-timer";
import LinearGradient from "react-native-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { useNavigation } from "@react-navigation/native";
import ChevronLeft from "@images/chevron-left-white.svg";
import PauseButton from "@images/pause.svg";
import PlayButton from "@images/arrowtriangle-right.svg";
import { useAppContext } from "./quick-bliss-context";
import { usePatternPlayer } from "../../hooks/usePatternPlayer";
import { wavePattern } from "../../store/patterns";
import { ConnectionPill } from "@common/components/connection-pill";

const TimerScreen = () => {
  const navigation = useNavigation();
  const { time } = useAppContext();
  const pattern = wavePattern(88);
  const { playing, toggle, stop } = usePatternPlayer(pattern, "bliss");

  const formatTime = (remainingTime: number) => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#2B2358", "#2B2358"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["#5E5DBF", "rgba(50, 41, 105, 0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      ></LinearGradient>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quick bliss</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
        <ConnectionPill />
      </View>
      <CountdownCircleTimer
        isPlaying={playing}
        duration={time * 60}
        colors={["#CCA0DD", "#CCA0DD"]}
        colorsTime={[30, 0]}
        trailColor={colors.grayLightest}
        size={300}
        strokeWidth={40}
        onComplete={() => {
          stop();
          return { shouldRepeat: false };
        }}
      >
        {({ remainingTime }) => {
          return (
            <>
              <Text style={styles.remainingTime}>
                {formatTime(remainingTime)}
              </Text>
            </>
          );
        }}
      </CountdownCircleTimer>
      <TouchableOpacity
        style={styles.pauseButton}
        onPress={toggle}
      >
        {playing ? <PauseButton /> : <PlayButton />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    alignItems: "center",
    justifyContent: "space-between",
  },
  header: {
    width: "100%",
    position: "relative",
  },
  headerTitle: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    position: "absolute",
    width: "100%",
  },
  backIcon: {
    width: 35,
    height: 35,
  },
  remainingTime: {
    fontSize: fontSizes.large,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
  },
  pauseButton: {
    width: 80,
    height: 80,
    borderRadius: 100,
    backgroundColor: "#666",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 50,
  },
});

export default TimerScreen;
