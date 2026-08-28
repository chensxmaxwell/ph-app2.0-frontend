import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import Untitled from "@images/Kink/untitled.svg";
import { SCREENS } from "../../common/constant/index";
import { useAppContext } from "./kink-context";
import { closeGenerate } from "./close-generate";
import { NavigationProp, ParamListBase } from "@react-navigation/native";

const KinkConfirmationScreen = () => {
  const navigation = useNavigation();

  const { emotion, intensity, sensitivity, funType, kinkName, kinkAvatar } =
    useAppContext();

  console.log(emotion, intensity, sensitivity, funType, kinkName, kinkAvatar);

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

      <View>
        <Text style={styles.header}>
          New kink Dominant {"\n"}has been generated!
        </Text>
      </View>

      {/* Icon and Name Section */}
      <View style={styles.iconContainer}>
        <View style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Untitled></Untitled>
          </View>
          <Text style={styles.iconLabel}>Untitled</Text>
        </View>
      </View>

      <View style={styles.Bottom}>
        {/* Start Button */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={() =>
            (navigation as NavigationProp<ParamListBase>).navigate(
              SCREENS.KINK_PLAY
            )
          }
        >
          <Text style={styles.startText}>Start</Text>
        </TouchableOpacity>

        {/* Return Button */}
        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => closeGenerate(navigation)}
        >
          <Text style={styles.returnText}>Return</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    justifyContent: "space-between",
  },
  header: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    textAlign: "center",
  },
  iconContainer: {
    alignItems: "center",
  },
  iconWrapper: {
    width: 160,
    height: 160,
    borderRadius: 20,
    backgroundColor: colors.grayLightest,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  iconCircle: {
    borderRadius: 50,
    backgroundColor: colors.grayLighter,
    height: 76,
    width: 76,
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  iconLabel: {
    fontSize: fontSizes.small,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
  Bottom: {
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 30,
    width: "100%",
    paddingHorizontal: 32,
  },
  startButton: {
    borderRadius: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: colors.grayLightest,
    paddingVertical: 16,
  },
  startText: {
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

export default KinkConfirmationScreen;
