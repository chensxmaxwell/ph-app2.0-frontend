import React, { useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Device from "@images/device.svg";
import { useOnboarding1 } from "./hooks";
import { useCustomAlert } from "@common/util";
import { colors } from "@common/styles/colors";
import { PillButton } from "@common/components/pill-button";
import { fontSizes, fontWeights } from "@common/styles/fonts";

export const OnBoardingStep1 = () => {
  const { handleNavigateToSkip, handleNavigateToOnBoarding2 } =
    useOnboarding1();
  const { showAlert, hideAlert } = useCustomAlert();
  const handleShowAlert = () =>
    showAlert({
      title: "Skip This Step?",
      message:
        "You can always complete this step later in Settings. Skipping now might impact your current setup.",
      primaryButton: {
        text: "Skip for Now",
        onPress: () => {
          hideAlert();
          handleNavigateToSkip();
        },
      },
      secondaryButton: {
        text: "Cancel",
        onPress: hideAlert,
      },
      cancelable: true,
    });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["rgba(108, 108, 108, 0.6)", "rgba(33, 33, 33, 0.6)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fill}
      />
      <Text style={styles.title}>Set up your devices</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.info}>
          Welcome to your new Pleasure House device. Setting it up is easy and
          quick. Just follow these simple steps, and you'll be ready to explore
          personalized pleasure in no time.
        </Text>
      </View>

      <View style={styles.imageContainer}>
        <Device />
      </View>
      <View style={styles.instructionContainer}>
        <Text style={styles.instruction}>
          Press and hold the button for 2 seconds to power on your toy until the
          light turns green
        </Text>
      </View>

      <TouchableOpacity
        style={styles.continueButton}
        onPress={handleNavigateToOnBoarding2}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.skipButton} onPress={handleShowAlert}>
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: "100%",
    overflow: "hidden",
    width: "100%",
    alignItems: "center",
    backgroundColor: "#585390",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  title: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
    marginTop: 70,
    fontFamily: "Quicksand",
    lineHeight: 25,
    textAlign: "center",
  },
  infoContainer: {
    width: "80%",
    alignItems: "center",
    alignSelf: "center",
    display: "flex",
    flexDirection: "column",
    marginTop: 40,
  },
  info: {
    fontFamily: "Quicksand",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16.25,
    textAlign: "center",
    color: "#F3F3F399",
  },
  imageContainer: {
    position: "absolute",
    top: 167,
  },
  instructionContainer: {
    marginTop: 331,
    width: "80%",
  },
  instruction: {
    fontSize: 20,
    lineHeight: 25,
    color: "#fcfcfc",
    fontWeight: "bold",
    fontFamily: "Quicksand",
    textAlign: "center",
  },
  continueButton: {
    width: 297,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#757585",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 103,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Quicksand",
    fontWeight: "bold",
  },
  skipButton: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  skipButtonText: {
    color: "#f3f3f3",
    fontSize: 13,
    fontFamily: "Quicksand",
    fontWeight: "bold",
    lineHeight: 16,
  },
});
