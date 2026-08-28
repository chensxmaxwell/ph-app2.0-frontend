import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import LinearGradient from "react-native-linear-gradient";
import { SCREENS } from "@common/constant";
import { useNavigation } from "@react-navigation/native";
import ChevronLeft from "@images/chevron-left-white.svg";
import RotateRingPicker from "@images/Kink/RotateRingPicker.svg";
import Pointer from "@images/Kink/pointer.svg";
import Naughty from "@images/Kink/naughty.svg";
import Angry from "@images/Kink/angry.svg";
import Sad from "@images/Kink/sad.svg";
import Meh from "@images/Kink/meh.svg";
import Happy from "@images/Kink/happy.svg";
import { useAppContext } from "./kink-context";
import { closeGenerate } from "./close-generate";

const emotions = [
  { text: "Angry", icon: Angry },
  { text: "Happy", icon: Happy },
  { text: "Naughty", icon: Naughty },
  { text: "Meh", icon: Meh },
  { text: "Sad", icon: Sad },
];

const { width } = Dimensions.get("window"); // Get the screen width
console.log("Screen width:", width);

const EmotionSelectionScreen = () => {
  const navigation = useNavigation();
  const rotation = useRef(new Animated.Value(0)).current;
  const accumulatedRotation = useRef(0); // Keep track of total rotation
  const [currentEmotion, setCurrentEmotion] = useState(emotions[0]); // Initial emotion

  // Example progress value state
  const [progress, setProgress] = useState(0.2);

  const { setEmotion } = useAppContext();

  let lastDx = 0;
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      const deltaDx = gestureState.dx - lastDx;
      lastDx = gestureState.dx;

      // Calculate rotation based on screen width
      let rotationChange = (deltaDx / width) * 360;
      accumulatedRotation.current += rotationChange;
      accumulatedRotation.current = Math.max(
        -360,
        Math.min(360, accumulatedRotation.current)
      );
      rotation.setValue(accumulatedRotation.current);

      // Update the emotion based on current rotation
      const emotion = calculateEmotion(accumulatedRotation.current);
      setCurrentEmotion(emotion);
      setEmotion(currentEmotion.text);
    },
    onPanResponderRelease: () => {
      lastDx = 0; // Reset for the next gesture
    },
  });

  // Define ranges for each emotion in degrees
  const angleRanges = [
    { min: -72, max: 0, index: 0 },
    { min: -144, max: -72, index: 4 },
    { min: -216, max: -144, index: 3 },
    { min: -288, max: -216, index: 2 },
    { min: -360, max: -288, index: 1 },
    { min: 0, max: 72, index: 0 },
    { min: 72, max: 144, index: 1 },
    { min: 144, max: 216, index: 2 },
    { min: 216, max: 288, index: 3 },
    { min: 288, max: 360, index: 4 },
  ];

  const calculateEmotion = (rotateValue: number) => {
    // Find the range where rotateValue falls
    const range = angleRanges.find(
      (r) => rotateValue >= r.min && rotateValue < r.max
    );
    const emotionIndex = range ? range.index : 0;

    // console.log("index: ", emotionIndex);
    return emotions[emotionIndex];
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
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Generate your own kink</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => closeGenerate(navigation)}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progress * 100}%` }, // Adjust width based on progress state
            ]}
          />
        </View>
      </View>

      <Text style={styles.text}>How are you feeling right now?</Text>

      {/* Emotion Display */}
      <View style={styles.emotionDisplay}>
        <currentEmotion.icon width={180} height={180} />
        <Text style={styles.emotionText}>{currentEmotion.text}</Text>
      </View>

      {/* SVG Circle with rotating emotion wheel positioned at bottom */}
      <Animated.View
        style={[
          styles.ringContainer,
          {
            transform: [
              {
                rotate: rotation.interpolate({
                  inputRange: [-width, 0, width],
                  outputRange: ["-360deg", "0deg", "360deg"],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <RotateRingPicker />
      </Animated.View>
      <Pointer style={styles.pointer}></Pointer>

      {/* Continue Button */}
      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => navigation.navigate(SCREENS.KINK_INTENSITY_SELECTION)}
      >
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    position: "relative",
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    height: 25,
  },
  backIcon: {
    position: "absolute",
    left: 20,
    top: 0,
    width: 35,
    height: 35,
  },
  progressBarContainer: {
    marginHorizontal: 32,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 20,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.grayLightest,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#cca0dd",
    borderRadius: 20,
  },
  text: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  ringContainer: {
    position: "absolute",
    bottom: -400,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  pointer: {
    position: "absolute",
    bottom: 180,
    left: 180,
  },
  emotionDisplay: {
    alignItems: "center",
    justifyContent: "center",
    margin: 40,
  },
  emotionText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    marginTop: 10,
  },
  continueButton: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    backgroundColor: colors.grayLightest,
    paddingVertical: 16,
    marginHorizontal: 32,
    borderRadius: 50,
  },
  continueText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
});

export default EmotionSelectionScreen;
