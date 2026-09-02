import React, { useEffect, useState } from "react";
import { View, StyleSheet, Animated, Text } from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";

const WAVE_MIN_HEIGHT = 100;
const WAVE_MAX_HEIGHT = 300;

const pctToHeight = (pct: number) =>
  WAVE_MIN_HEIGHT +
  (Math.max(0, Math.min(100, pct)) / 100) * (WAVE_MAX_HEIGHT - WAVE_MIN_HEIGHT);

type WaveformAdjustableProps = {
  sensitivityPct?: number;
};

const WaveformAdjustable = ({
  sensitivityPct = 0,
}: WaveformAdjustableProps) => {
  const [waveHeight] = useState(
    () => new Animated.Value(pctToHeight(sensitivityPct))
  );

  useEffect(() => {
    waveHeight.setValue(pctToHeight(sensitivityPct));
  }, [sensitivityPct, waveHeight]);

  const animatedHeight = waveHeight.interpolate({
    inputRange: [WAVE_MIN_HEIGHT, WAVE_MAX_HEIGHT],
    outputRange: [WAVE_MIN_HEIGHT, WAVE_MAX_HEIGHT],
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
              inputRange: [WAVE_MIN_HEIGHT, WAVE_MAX_HEIGHT],
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
