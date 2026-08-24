import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { useNavigation } from "@react-navigation/native";
import Xmark from "@images/icons/xmark.svg";

const MotionIntroScreen = () => {
  const navigation = useNavigation();

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => {
            console.log("LightBulb pressed");
            navigation.goBack();
          }}
        >
          <Xmark width={20} height={20} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Motion sensor</Text>
        <Text style={styles.content}>
          Motion sensor puts the power in your hands like how you hold your wine
          glass. Your toy’s vibration frequency responds to how you shake your
          phone. The faster you move, the more wave you create, the stronger the
          vibration. Want to turn things up? Just shake a little more. Prefer a
          gentler touch? Slow it down and let the magic adjust to your rhythm.
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    width: "100%",
    position: "relative",
    marginTop: 50,
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
  },
});

export default MotionIntroScreen;
