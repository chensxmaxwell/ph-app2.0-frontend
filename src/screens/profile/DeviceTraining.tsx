import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { useNavigation } from "@react-navigation/native";
import ChevronDownIcon from "@images/chevron-down-white.svg";
import ChevronUpIcon from "@images/chevron-up-white.svg";

const DeviceTrainingScreen = () => {
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [exerciseFrequency, setExerciseFrequency] = useState(
    "Select your exercise frequency"
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const exerciseOptions = ["0-1 per week", "2-4 per week", "5-7 per week"];

  const navigation = useNavigation();
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };
  const selectOption = (option: string) => {
    setExerciseFrequency(option);
    setDropdownOpen(false);
  };
  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="large">
      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Device training</Text>
          <Text style={styles.description}>
            We’re all about making your Pleasure House journey uniquely yours.
            By sharing a little information with us, you’ll help our AI learn
            what you love.
          </Text>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Height</Text>
          <View style={styles.heightContainer}>
            <TextInput
              style={styles.heightInput}
              value={heightFeet}
              onChangeText={setHeightFeet}
              keyboardType="numeric"
              //   maxLength={2}
            />
            <Text style={styles.heightUnit}>‘</Text>
            <TextInput
              style={styles.heightInput}
              value={heightInches}
              onChangeText={setHeightInches}
              keyboardType="numeric"
              //   maxLength={2}
            />
            <Text style={styles.heightUnit}>”</Text>
          </View>

          <Text style={styles.label}>Weight</Text>
          <View style={styles.weightContainer}>
            <TextInput
              style={styles.weightInput}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
            <Text style={styles.weightUnit}>lb</Text>
          </View>

          <Text style={styles.label}>Exercise frequency</Text>
          <View>
            <TouchableOpacity
              style={styles.pickerContainer}
              onPress={toggleDropdown}
            >
              {!dropdownOpen && <ChevronDownIcon height={35} />}
              {dropdownOpen && <ChevronUpIcon height={35} />}
              <Text style={styles.pickerText}>{exerciseFrequency}</Text>
            </TouchableOpacity>

            {/* Dropdown Options */}
            {dropdownOpen && (
              <View style={styles.dropdown}>
                {exerciseOptions.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dropdownOption,
                      index === exerciseOptions.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                    onPress={() => selectOption(option)}
                  >
                    <Text style={styles.dropdownOptionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Button Section */}
        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save changes</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  // Header Section
  headerSection: {},
  title: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    marginBottom: 20,
  },
  description: {
    fontSize: fontSizes.small,
    color: colors.grayLighter,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    marginBottom: 30,
  },
  // Input Section
  inputSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    height: 24,
    marginBottom: 10,
  },
  heightContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  heightInput: {
    backgroundColor: colors.grayLight,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    borderRadius: 50,
    paddingHorizontal: 16,
    width: 100,
    height: 40,
    textAlign: "center",
  },
  heightUnit: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "OpenSans-Regular",
    marginHorizontal: 8,
    height: 40,
  },
  weightContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  weightInput: {
    backgroundColor: colors.grayLight,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    borderRadius: 20,
    flex: 1,
    height: 40,
    textAlign: "center",
  },
  weightUnit: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    marginLeft: 16,
  },
  pickerContainer: {
    backgroundColor: colors.grayLight,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 20,
    height: 40,
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
  },
  pickerText: {
    color: colors.grayLighter,
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    flex: 1,
    textAlign: "center",
    position: "relative",
  },
  // Dropdown menu styles
  dropdown: {
    backgroundColor: colors.grayLightest,
    borderRadius: 10,
    marginTop: 10,
    width: "100%",
    position: "absolute",
    top: 40,
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    borderStyle: "solid",
  },
  dropdownOptionText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
    textAlign: "center",
  },
  // Button Section
  buttonSection: {
    marginTop: 30,
    marginBottom: 70,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: colors.grayLightest,
    borderRadius: 50,
    paddingHorizontal: 32,
    height: 50,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  cancelText: {
    fontSize: fontSizes.small,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
});

export default DeviceTrainingScreen;
