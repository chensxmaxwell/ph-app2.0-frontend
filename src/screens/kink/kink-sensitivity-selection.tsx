import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import Xmark from "@images/xmark.svg";
import { SCREENS } from "@common/constant";
import { useAppContext } from "./kink-context";

const sensitivityText = [
  "You Are Not Sensitive At All.",
  "You Are Slightly Sensitive.",
  "You Are Moderately Sensitive.",
  "You Are Highly Sensitive.",
  "You Are Extremely Sensitive.",
];
const SensitivitySelectionScreen = () => {
  const navigation = useNavigation();
  const [progress, setProgress] = useState(0.4);

  const [selectedValue, setSelectedValue] = useState(5);

  const { setSensitivity } = useAppContext();

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
          onPress={() => navigation.navigate(SCREENS.KINK_SELECTION)}
        >
          <Xmark width={35} height={35} />
        </TouchableOpacity>
      </View>

      <View>
        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>
        <Text style={styles.promptText}>
          How would you rate your {"\n"}sensitivity level?
        </Text>
      </View>

      {/* Number Display */}
      <Text style={styles.numberDisplay}>{selectedValue}</Text>

      {/* Number Picker */}
      <View style={styles.pickerContainer}>
        {[1, 2, 3, 4, 5].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.pickerItem,
              selectedValue === num && styles.selectedPickerItem,
            ]}
            onPress={() => (setSelectedValue(num), setSensitivity(num))}
          >
            <Text style={styles.pickerText}>{num}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Description */}
      <Text style={styles.descriptionText}>
        {sensitivityText[selectedValue - 1]}
      </Text>

      {/* Spacer to push buttons to the bottom */}
      <View style={{ flexGrow: 1 }} />

      {/* Continue Button */}
      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => navigation.navigate(SCREENS.KINK_FUNTYPE)}
      >
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>

      {/* Return Button */}
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
    justifyContent: "flex-start",
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
  },
  backIcon: {
    position: "absolute",
    left: 20,
    top: 0,
    width: 35,
    height: 35,
  },
  progressBarContainer: {
    paddingHorizontal: 32,
    marginTop: 32,
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
  promptText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    textAlign: "center",
    marginVertical: 30,
  },
  numberDisplay: {
    fontSize: 96,
    color: "#cca0dd",
    textAlign: "center",
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    lineHeight: 96,
    marginTop: 48,
  },
  pickerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.grayLightest,
    padding: 8,
    marginHorizontal: 32,
    marginVertical: 20,
    borderRadius: 1234,
  },
  pickerItem: {
    width: "20%",
    borderRadius: 1234,
    padding: 8,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedPickerItem: {
    backgroundColor: "#cca0dd",
  },
  pickerText: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
  descriptionText: {
    textAlign: "center",
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.grayLighter,
    fontSize: fontSizes.medium2X,
  },
  continueButton: {
    backgroundColor: colors.grayLightest,
    paddingVertical: 16,
    marginHorizontal: 32,
    borderRadius: 50,
  },
  continueText: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  returnButton: {
    backgroundColor: "transparent",
    paddingVertical: 16,
    marginHorizontal: 32,
    borderRadius: 50,
    marginBottom: 40,
    alignSelf: "center",
  },
  returnText: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
});

export default SensitivitySelectionScreen;
