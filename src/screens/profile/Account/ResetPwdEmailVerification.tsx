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
import ChevronLeft from "@images/chevron-left-white.svg";
import { SCREENS } from "@common/constant";
import { NavigationType } from "../../../../App";

const ResetPwdEmailVerificationScreen = () => {
  const navigation = useNavigation<NavigationType>();
  const [verificationCode, setVerificationCode] = useState("");

  const handleVerify = () => {
    navigation.navigate(SCREENS.PROFILE_SETTING_ACCOUNT_RESET_PASSWORD);
  };

  const handleResendCode = () => {};

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Email verification</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.topSection}>
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>
              To reset your password, please verify your email.
            </Text>
            <Text style={styles.description}>
              We have sent a verification code via your email.
            </Text>
            <Text style={styles.email}>12345@gamil.com</Text>
          </View>
        </View>

        <View style={styles.middleSection}>
          <Text style={styles.verificationCode}>Verification code</Text>
          <TextInput
            style={styles.input}
            placeholder="Verification code"
            placeholderTextColor={colors.grayLighter}
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="numeric"
          />
          <TouchableOpacity onPress={handleResendCode}>
            <Text style={styles.resendText}>
              Didn’t receive verification code?{" "}
              <Text style={styles.resendLink}>Resend</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
            <Text style={styles.verifyButtonText}>Verify</Text>
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
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.white,
    marginBottom: 50,
    textAlign: "center",
  },
  verificationCode: {
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
  resendText: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
    textAlign: "center",
  },
  resendLink: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
  },
  verifyButton: {
    backgroundColor: colors.grayLightest,
    borderRadius: 50,
    width: "100%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  verifyButtonText: {
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

export default ResetPwdEmailVerificationScreen;
