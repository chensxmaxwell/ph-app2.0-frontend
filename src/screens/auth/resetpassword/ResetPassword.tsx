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

import EyeOpenIcon from "@images/EyeOpenIcon.svg";
import EyeClosedIcon from "@images/EyeClosedIcon.svg";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { NavigationType } from "../../../../App";

const ResetPasswordScreen = () => {
  const navigation = useNavigation<NavigationType>();
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleResetPassword = () =>
    navigation.navigate(SCREENS.PASSWORD_RESET_CONFIRM);

  const toggleShowNewPassword = () => {
    setShowNewPassword(!showNewPassword);
  };

  const toggleShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <ScreenWrapper backgroundType="gray">
      <View style={styles.container}>
        <View style={styles.topSection}>
          <Text style={styles.title}>Reset Password</Text>
        </View>

        <View style={styles.middleSection}>
          <Text style={styles.newPassword}>New Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor={colors.grayLighter}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              keyboardType="default"
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={toggleShowNewPassword}
            >
              {showNewPassword ? (
                <EyeOpenIcon width={25} height={25} />
              ) : (
                <EyeClosedIcon width={25} height={25} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.newPassword}>Confirm new Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.grayLighter}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry={!showConfirmPassword}
              keyboardType="default"
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={toggleShowConfirmPassword}
            >
              {showConfirmPassword ? (
                <EyeOpenIcon width={25} height={25} />
              ) : (
                <EyeClosedIcon width={25} height={25} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleResetPassword}
          >
            <Text style={styles.confirmButtonText}>Confirm</Text>
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
  middleSection: {
    flex: 1,
    justifyContent: "center",
    height: "100%",
  },
  bottomSection: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: fontSizes.medium2X,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.whitePrimary,
    marginBottom: 20,
  },
  newPassword: {
    fontSize: fontSizes.medium2X,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.whitePrimary,
    textAlign: "left",
    marginBottom: 15,
    verticalAlign: "bottom",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grayLightest,
    borderRadius: 25,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    height: 40,
    color: colors.whitePrimary,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
  },
  showPasswordButton: {
    paddingHorizontal: 16,
  },
  confirmButton: {
    backgroundColor: colors.grayLightest,
    borderRadius: 50,
    width: "100%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  confirmButtonText: {
    color: colors.whitePrimary,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.medium2X,
  },
  cancelText: {
    color: colors.whitePrimary,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.medium2X,
  },
});

export default ResetPasswordScreen;
