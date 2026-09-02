import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Text } from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 300;

const heightForPct = (pct: number) =>
  MIN_HEIGHT + (Math.max(0, Math.min(100, pct)) / 100) * (MAX_HEIGHT - MIN_HEIGHT);

type Props = {
  sensitivityPct: number;
};

const WaveformAdjustable = ({ sensitivityPct }: Props) => {
  const waveHeight = useRef(new Animated.Value(heightForPct(sensitivityPct)))
    .current;

  useEffect(() => {
    waveHeight.setValue(heightForPct(sensitivityPct));
  }, [sensitivityPct, waveHeight]);

  const animatedHeight = waveHeight.interpolate({
    inputRange: [MIN_HEIGHT, MAX_HEIGHT],
    outputRange: [MIN_HEIGHT, MAX_HEIGHT],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Sensitivity</Text>
      <Animated.Image
        style={[styles.waveImage, { height: animatedHeight }]}
        source={require("../../../assets/images/wave4.png")}
      />
      <Animated.Image
        style={[styles.waveImage, { height: animatedHeight }]}
        source={require("../../../assets/images/wave3.png")}
      />
      <Animated.Text
        style={[
          styles.sensitivityValue,
          {
            height: animatedHeight.interpolate({
              inputRange: [MIN_HEIGHT, MAX_HEIGHT],
              outputRange: [90, 280],
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        {Math.round(sensitivityPct)}%
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
    height: 350,
  },
  header: {
    textAlign: "center",
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.medium2X,
  },
  waveImage: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 300,
    resizeMode: "stretch",
  },
  sensitivityValue: {
    position: "absolute",
    left: 175,
    bottom: 0,
    height: 290,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.small,
  },
});

export default WaveformAdjustable;
