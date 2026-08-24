import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
} from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { FULL_SIZE } from "@common/constant";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { BackButton } from "@common/components/back-button";
import { spacings } from "@common/styles/spacings";
import { BaseText } from "@common/components/base-text";
import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../../../../App";
import { usePattern } from "./hooks";

export const SavePattern: React.FC = () => {
  const { handleSavePatternPress, handleReturnPress } = usePattern();
  const navigation = useNavigation<NavigationType>();
  const [patternName, setPatternName] = useState("");

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <BackButton />
          <BaseText style={styles.titleText}>Save Pattern</BaseText>
          <TouchableOpacity></TouchableOpacity>
        </View>

        {/* Input Text Section */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={patternName}
            onChangeText={setPatternName}
            placeholder="Enter pattern name"
            placeholderTextColor={colors.grayLight}
          />
        </View>

        <View style={styles.Bottom}>
          {/* Start Button */}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => handleSavePatternPress(patternName)}
          >
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>

          {/* Return Button */}
          <TouchableOpacity
            style={styles.returnButton}
            onPress={handleReturnPress}
          >
            <Text style={styles.returnText}>Return</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: "hidden",
    width: FULL_SIZE,
    display: "flex",
    alignItems: "center",
  },
  titleContainer: {
    width: FULL_SIZE,
    paddingHorizontal: spacings.w16,
    paddingTop: spacings.h16,
    paddingBottom: spacings.h34,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleText: {
    color: colors.white,
    fontSize: fontSizes.large,
    fontWeight: fontWeights.bold,
  },
  inputContainer: {
    width: FULL_SIZE,
  },
  inputLabel: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    lineHeight: 25,
    marginBottom: 8,
    fontFamily: "Quicksand",
    paddingHorizontal: 32,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.white,
    backgroundColor: colors.grayLightest,
    color: colors.white,
    borderRadius: 20,
    marginHorizontal: 32,
    paddingHorizontal: 16,
    fontSize: fontSizes.small,
    fontFamily: "Quicksand",
    fontWeight: fontWeights.bold,
  },
  Bottom: {
    position: "absolute",
    bottom: -30,
    justifyContent: "center",
    width: FULL_SIZE,
    paddingHorizontal: spacings.w16,
    paddingBottom: spacings.h34,
    alignItems: "center",
  },
  saveButton: {
    borderRadius: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: colors.grayLightest,
    paddingVertical: 16,
  },
  saveText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    textAlign: "center",
    height: 23,
  },
  returnButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  returnText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    height: 23,
  },
});
