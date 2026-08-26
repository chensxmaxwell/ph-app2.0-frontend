import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import Xmark from "@images/xmark.svg";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { SCREENS } from "@common/constant";
import { useAppContext } from "./kink-context";
import { closeGenerate } from "./close-generate";

const options = [
  "Orgasm Control",
  "Dominance",
  "Submission",
  "Mirror Play",
  "Scene/Role Play",
  "Sadism",
  "Masochism",
  "Humiliation",
  "Costume Play",
  "Discipline",
  "Bondage",
];

const FunTypeSelectionScreen = () => {
  const navigation = useNavigation();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [progress, setProgress] = useState(0.6);

  const { setfunType } = useAppContext();

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
        <Text style={styles.promptText}>What type of fun are you feeling?</Text>
      </View>

      <View style={styles.listContainer}>
        {/* Options List */}
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.option,
                selectedOption === item && styles.selectedOption,
              ]}
              onPress={() => (setSelectedOption(item), setfunType(item))}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedOption === item && styles.selectedOptionText,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Spacer to push buttons to the bottom */}
      <View style={{ flexGrow: 1 }} />

      {/* Continue Button */}
      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => navigation.navigate(SCREENS.KINK_SAVE)}
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
  listContainer: {
    marginTop: 50,
    maxHeight: 300,
    overflow: "hidden",
    paddingHorizontal: 32,
  },
  option: {
    marginVertical: 16,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  selectedOption: {},
  optionText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.grayLighter,
  },
  selectedOptionText: {
    fontSize: fontSizes.largeX,
    color: colors.white,
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

export default FunTypeSelectionScreen;
