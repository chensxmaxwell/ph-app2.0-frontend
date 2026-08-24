import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { useNavigation } from "@react-navigation/native";
import ChevronLeft from "@images/chevron-left-white.svg";
import { Slider } from "@miblanchard/react-native-slider";
import { SCREENS } from "@common/constant";
import { useAppContext } from "./quick-bliss-context";

const SliderScreen = () => {
  const navigation = useNavigation();
  const [value, setValue] = useState(15);
  const { setTime } = useAppContext();

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quick bliss</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <Text style={styles.timeText}>{value}:00</Text>
        <View style={styles.sliderContainer}>
          <Slider
            value={value}
            onValueChange={(val: number | number[]) => {
              const newValue = Array.isArray(val) ? val[0] : val;
              setValue(newValue);
              setTime(newValue);
            }}
            minimumValue={5}
            maximumValue={15}
            step={1}
            minimumTrackTintColor="#CCA0DD"
            thumbTintColor={colors.white}
            thumbStyle={styles.thumb}
            trackStyle={styles.track}
          />
        </View>
        <View style={styles.labelsContainer}>
          <Text style={styles.label}>5 mins</Text>
          <Text style={styles.label}>15 mins</Text>
        </View>
      </View>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => navigation.navigate(SCREENS.BLISS_TIMER)}
        >
          <Text style={styles.saveButtonText}>Start</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    width: "100%",
    position: "relative",
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
  scrollContainer: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  title: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    marginTop: 30,
  },
  content: {
    fontSize: fontSizes.small,
    color: colors.white,
    fontFamily: "OpenSans-Regular",
    lineHeight: 24,
    marginTop: 20,
    textAlign: "justify",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  timeText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    marginVertical: 32,
    lineHeight: 30,
  },
  sliderContainer: {
    width: "90%",
    alignItems: "center",
    marginBottom: 32,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    shadowColor: "#CCA0DD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  track: {
    width: 328,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grayLightest,
  },
  labelsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  label: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    lineHeight: 25,
    fontFamily: "Quicksand-Bold",
  },
  buttonsContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  saveButton: {
    backgroundColor: colors.grayLightest,
    width: "100%",
    borderRadius: 50,
    height: 50,
    paddingVertical: 10,
    marginBottom: 10,
    alignItems: "center",
    marginHorizontal: 16,
  },
  saveButtonText: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
  cancelText: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
});

export default SliderScreen;
