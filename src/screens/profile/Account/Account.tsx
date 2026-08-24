import React from "react";
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
import ChevronRightIcon from "@images/chevron-right-white.svg";
import { useNavigation } from "@react-navigation/native";
import ChevronLeft from "@images/chevron-left-white.svg";
import { SCREENS } from "@common/constant";
import { NavigationType } from "../../../../App";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useProfile } from "../hooks";

const AccountScreen = () => {
  const navigation = useNavigation<NavigationType>();
  const { user } = useProfile();

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Email Section */}
        <Text style={styles.label}>Email</Text>

        <TextInput
          style={styles.input}
          value={user?.email ?? "Loading..."}
          editable={false}
        />

        {/* Reset Email */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() =>
            navigation.navigate(
              SCREENS.PROFILE_SETTING_ACCOUNT_RESET_PASSWORD_STACK
            )
          }
        >
          <Text style={styles.optionText}>Reset email</Text>
          <ChevronRightIcon width={35} height={35} />
        </TouchableOpacity>

        {/* Reset Password */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() =>
            navigation.navigate(
              SCREENS.PROFILE_SETTING_ACCOUNT_RESET_EMAIL_STACK
            )
          }
        >
          <Text style={styles.optionText}>Reset password</Text>
          <ChevronRightIcon width={35} height={35} />
        </TouchableOpacity>

        {/* Delete Account */}
        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete account</Text>
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
    width: "100%",
  },
  label: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    marginBottom: 20,
  },
  input: {
    color: colors.white,
    backgroundColor: colors.grayLight,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.small,
    height: 40,
    borderRadius: 20,
    textAlign: "left",
    paddingLeft: 16,
    marginBottom: 30,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  optionText: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
  },
  // Button Section
  buttonSection: {
    marginTop: "auto",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 60,
  },
  deleteButton: {
    backgroundColor: colors.grayLightest,
    borderRadius: 50,
    paddingVertical: 15,
    width: "100%",
    height: 50,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
  },
});

export default AccountScreen;
