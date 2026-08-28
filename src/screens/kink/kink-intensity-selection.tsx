import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import LinearGradient from "react-native-linear-gradient";
import { SCREENS } from "@common/constant";
import { useNavigation } from "@react-navigation/native";
import { closeGenerate } from "./close-generate";
import ChevronLeft from "@images/chevron-left-white.svg";
import WaveformAdjustable from "./wave";

const IntensitySelectionScreen = () => {
  const navigation = useNavigation();

  const [progress, setProgress] = useState(0.4);

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

        <View>
          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress * 100}%` },
                ]}
              />
            </View>
          </View>

          <Text style={styles.text}>How would you like the intensity?</Text>
        </View>
      </View>

      <WaveformAdjustable></WaveformAdjustable>

      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => navigation.navigate(SCREENS.KINK_SENSITIVITY_SELECTION)}
      >
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.returnButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.returnText}>Return</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    position: "relative",
    justifyContent: "space-between",
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
    marginTop: 32,
    marginBottom: 48,
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
  continueButton: {
    position: "absolute",
    bottom: 100,
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
  returnButton: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    paddingVertical: 16,
    marginHorizontal: 32,
    borderRadius: 50,
    alignSelf: "center",
  },
  returnText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
});

export default IntensitySelectionScreen;
