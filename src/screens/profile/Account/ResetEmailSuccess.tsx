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

const ResetEmailSuccessScreen = () => {
  const navigation = useNavigation();

  const handleResetPassword = () => {};

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <View style={styles.container}>
        <View style={styles.topSection}>
          <Text style={styles.title}>Reset Email</Text>
        </View>

        <View style={styles.middleSection}>
          <Text style={styles.yayText}>Yay!</Text>
          <Text style={styles.messageText}>Your password has been reset.</Text>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleResetPassword}
          >
            <Text style={styles.confirmButtonText}>Login</Text>
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
  yayText: {
    fontSize: fontSizes.medium2X,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.white,
    textAlign: "center",
    paddingBottom: 20,
  },
  messageText: {
    fontSize: fontSizes.small,
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    textAlign: "center",
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
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.medium2X,
  },
  cancelText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.medium2X,
  },
});

export default ResetEmailSuccessScreen;
