import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { colors } from "@common/styles/colors";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { NavigationType } from "../../../../App";

const ResetEmailScreen = () => {
  const [NewEmail, setNewEmail] = useState("");
  const navigation = useNavigation<NavigationType>();
  const handleContinue = () => {
    navigation.navigate(
      SCREENS.PROFILE_SETTING_ACCOUNT_RESET_EMAIL_VERIFICATION
    );
  };
  return (
    <ScreenWrapper backgroundType="gray">
      <View style={styles.container}>
        <View style={styles.topSection}>
          <Text style={styles.title}>Reset email</Text>
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>
              Please enter your new email address.
            </Text>
          </View>
        </View>

        <View style={styles.middleSection}>
          <Text style={styles.email}>New Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.grayLighter}
            value={NewEmail}
            onChangeText={setNewEmail}
          />
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
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
    paddingHorizontal: 0,
    width: "100%",
  },
  topSection: {
    flex: 1,
    alignItems: "center",
  },
  descriptionContainer: {
    marginTop: 20,
  },
  middleSection: {
    flex: 1,
    justifyContent: "flex-start",
    height: "100%",
  },
  bottomSection: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: fontSizes.medium2X,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.white,
    marginBottom: 20,
  },
  description: {
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.grayLighter,
    textAlign: "center",
  },
  email: {
    fontSize: fontSizes.medium2X,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.white,
    textAlign: "center",
    marginBottom: 15,
    verticalAlign: "bottom",
  },
  input: {
    backgroundColor: colors.grayLightest,
    borderRadius: 20,
    height: 40,
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: colors.grayLightest,
    borderRadius: 50,
    width: "100%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  continueButtonText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
  },
  cancelText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
  },
});

export default ResetEmailScreen;
