import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { colors } from "@common/styles/colors";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { useNavigation } from "@react-navigation/native";
import ChevronLeft from "@images/chevron-left-white.svg";
import { NavigationType } from "../../../App";
import ChevronDownIcon from "@images/chevron-down-white.svg";
import ChevronUpIcon from "@images/chevron-up-white.svg";

const LanguageScreen = () => {
  const navigation = useNavigation<NavigationType>();

  const [languege, setLanguege] = useState("English (US)");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const languageOptions = ["English (US)"];

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };
  const selectOption = (option: string) => {
    setLanguege(option);
    setDropdownOpen(false);
  };

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Languege</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Language Section */}
        <View>
          <Text style={styles.label}>Select language</Text>

          <TouchableOpacity
            style={styles.pickerContainer}
            onPress={toggleDropdown}
          >
            {!dropdownOpen && <ChevronDownIcon height={35} />}
            {dropdownOpen && <ChevronUpIcon height={35} />}
            <Text style={styles.pickerText}>{languege}</Text>
          </TouchableOpacity>

          {/* Dropdown Options */}
          {dropdownOpen && (
            <View style={styles.dropdown}>
              {languageOptions.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownOption,
                    index === languageOptions.length - 1 && {
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
  // Header Section
  header: {
    width: "100%",
    position: "relative",
    marginBottom: 20,
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
  container: {
    flex: 1,
    justifyContent: "space-between",
    width: "100%",
  },
  label: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    marginBottom: 20,
  },

  pickerContainer: {
    backgroundColor: colors.grayLight,
    paddingHorizontal: 16,
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
    // textAlign: "center",
    position: "relative",
  },
  // Dropdown menu styles
  dropdown: {
    backgroundColor: colors.grayLightest,
    borderRadius: 10,
    marginTop: 10,
    width: "100%",
    position: "absolute",
    top: 80,
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
    margin: 30,
    alignItems: "center",
    marginBottom: 60,
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

export default LanguageScreen;
