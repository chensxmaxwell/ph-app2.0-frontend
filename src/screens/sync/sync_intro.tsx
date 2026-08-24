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
import Xmark from "@images/xmark.svg";

const SyncIntro = () => {
  const navigation = useNavigation();

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sync</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <Xmark width={35} height={35} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Snyc</Text>
        <Text style={styles.content}>
          One of the key benefits of using Pleasure House is its ability to
          sync, enabling you to stay connected with those you enjoy, even from a
          distance. This feature adds an extra spark to your experience, keeping
          the fun alive no matter where you are with your partner.
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
    fontFamily: "Quicksand-Bold",
    lineHeight: 24,
    marginTop: 20,
  },
});

export default SyncIntro;
