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

const KinkIntroScreen = () => {
  const navigation = useNavigation();

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <TouchableOpacity
        style={styles.backIcon}
        onPress={() => navigation.goBack()}
      >
        <ChevronLeft width={35} height={35} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Kink</Text>
        <Text style={styles.content}>
          Kinks and fetishes can sometimes feel taboo, but exploring your
          desires is completely natural.
        </Text>
        <Text style={styles.content}>
          Sexual preferences are deeply personal, and there’s no shame in
          exploring your curiosity. Our Kink Mode allows you to safely embrace
          your desires and try new experiences, while remaining open to the
          surprises your body may reveal.
        </Text>
        <Text style={styles.content}>
          Each choice represents the role you want your toy to play. For
          instance, if you feel submissive but want a dominant experience,
          simply select the Dominant Mode and enjoy the dynamic.
        </Text>
        <Text style={styles.content}>
          If you can’t find what you typical joy, create your own unique
          experience by choosing ‘create’. Connect with your deepest desire and
          discover the unexpected pleasures waiting for you.
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
    minWidth: "100%",
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
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    lineHeight: 24,
    marginTop: 20,
    textAlign: "left",
  },
});

export default KinkIntroScreen;
