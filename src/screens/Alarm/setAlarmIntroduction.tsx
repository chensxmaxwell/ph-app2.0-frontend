import React, { useCallback, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import Xmark from "@images/xmark.svg";
import LinearGradient from "react-native-linear-gradient";
import AddIcon from "@images/AddIcon.svg";
import { SCREENS } from "@common/constant";
import { loadAlarms } from "../../store/alarms";

const SetAlarmIntroductionScreen = () => {
  const navigation = useNavigation();
  const [hasAlarms, setHasAlarms] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAlarms().then((alarms) => setHasAlarms(alarms.length > 0));
    }, [])
  );

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
      ></LinearGradient>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Set Alarm</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <Xmark width={35} height={35} />
        </TouchableOpacity>
      </View>

      {/* Illustration Section */}
      <View style={styles.content}>
        <Image
          source={require("../../../assets/images/sunset.png")}
          style={styles.illustration}
        />
        {/* Text Section */}
        <View style={styles.textContainer}>
          <Text style={styles.heading}>
            Schedule one or more alarms for your toy
          </Text>
          <Text style={styles.subText}>
            When the alarm goes off, your toy will vibrate for the duration
            according to the mode you selected.
          </Text>
        </View>
      </View>

      {/* Add Alarm Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate(SCREENS.SETALARM_TIME)}
      >
        <AddIcon width={40} height={40} />
      </TouchableOpacity>
      {hasAlarms ? (
        <TouchableOpacity
          style={styles.listButton}
          onPress={() => navigation.navigate(SCREENS.SETALARM_LIST)}
        >
          <Text style={styles.listButtonText}>My alarms</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: 60,
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
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
  content: {
    flex: 1,
    alignItems: "center",
  },
  illustration: {
    width: 200,
    height: 200,
    resizeMode: "contain",
  },
  textContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  heading: {
    fontSize: fontSizes.medium2X,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.white,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 32,
  },
  subText: {
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.white,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  addButton: {
    backgroundColor: "#5E5DBF",
    width: 64,
    height: 64,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 30,
    right: 32,
  },
  listButton: {
    position: "absolute",
    bottom: 38,
    left: 32,
    backgroundColor: colors.grayLightest,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  listButtonText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
  },
});

export default SetAlarmIntroductionScreen;
