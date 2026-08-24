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
import ChevronLeft from "@images/chevron-left-white.svg";

const SoundIntroductionScreen = () => {
  const navigation = useNavigation();

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Sound</Text>
        <Text style={styles.content}>
          Sound mode will automatically adjusts your toy's vibration based on
          real-time detection of surrounding sound levels. You can adjust the
          sensitivity to suit your comfort. Shout out loud, play some music, or
          let the sounds around you shape a unique experience.
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    width: "100%",
    position: "relative",
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
    fontSize: fontSizes.smallX,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    lineHeight: 27,
    marginTop: 20,
    // textAlign: "justify",
  },
});

export default SoundIntroductionScreen;
