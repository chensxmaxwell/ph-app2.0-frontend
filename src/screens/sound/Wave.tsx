import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Text,
} from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";

const WaveformAdjustable = () => {
  const [waveHeight] = useState(new Animated.Value(300)); // Start with height 300

  // Define a baseY to track the starting Y position
  const [baseY, setBaseY] = useState(0); // Store the initial Y position
  const [currentHeight, setCurrentHeight] = useState(300);
  const [text, setText] = useState(100);

  let newHeight = 300;
  // Use PanResponder to capture touch gestures
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,

    // Capture the start of the gesture
    onPanResponderGrant: (event, gestureState) => {
      setBaseY(gestureState.moveY); // Save the initial Y position when touch begins
      //   console.log("Gesture Start - x0, y0:", gestureState.x0, gestureState.y0);
    },

    // Track the movement and use moveY to set the wave height
    onPanResponderMove: (
      event: GestureResponderEvent,
      gestureState: PanResponderGestureState
    ) => {
      newHeight = currentHeight - (gestureState.moveY - baseY); // Adjust based on how far moveY is from baseY
      newHeight = Math.min(newHeight, 300);
      newHeight = Math.max(newHeight, 100);
      // Set the height value
      waveHeight.setValue(newHeight);

      setText(Math.round(((newHeight - 100) / 200) * 100));
    },

    onPanResponderRelease: () => {
      setCurrentHeight(newHeight);
    },
  });

  // Use interpolation for smoothness
  const animatedHeight = waveHeight.interpolate({
    inputRange: [100, 300],
    outputRange: [100, 300],
    extrapolate: "clamp", // Prevent values outside the range
  });

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Text style={styles.header}>Sensitivity</Text>
      <Animated.Image
        style={[
          styles.waveImage,
          { height: animatedHeight }, // Use interpolated value for smoother transition
        ]}
        source={require("../../../assets/images/wave4.png")}
      />
      <Animated.Image
        style={[
          styles.waveImage,
          { height: animatedHeight }, // Another wave with same dynamic height
        ]}
        source={require("../../../assets/images/wave3.png")}
      />
      <Animated.Text
        style={[
          styles.sensitivityValue,
          {
            height: animatedHeight.interpolate({
              inputRange: [100, 300],
              outputRange: [90, 280], // Shift the height by subtracting 50
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        {text}%
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
    height: 300, // Default height
    resizeMode: "stretch",
  },
  sensitivityValue: {
    position: "absolute",
    left: 175,
    bottom: 0,
    height: 290, // Default height
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.small,
  },
});

export default WaveformAdjustable;
