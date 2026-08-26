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

const ProfileSettingAbout = () => {
  const navigation = useNavigation();

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>About</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Pleasure House</Text>
        <Text style={styles.content}>
          Pleasure House is an app for playing with a companion and a connected
          device. You can create someone to talk to, start a Love session, and
          drive the toy from Control, Message, or Sync.
        </Text>
        <Text style={styles.content}>
          The four tabs are Home, Control, Message, and Profile. Love is a
          session on top of those tabs, not a fifth one. A minimized session
          stays visible as a pill so you can jump back in from anywhere.
        </Text>
        <Text style={styles.content}>
          This build is a demo. Pairing uses a simulated connection, and some
          looks are male-only until more models ship. We will keep the product
          private, local-first, and easy to leave.
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
    marginBottom: 100,
  },
  title: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    marginTop: 30,
  },
  content: {
    fontSize: 16,
    color: colors.white,
    fontFamily: "Quicksand-Regular",
    lineHeight: 24,
    marginTop: 20,
  },
});

export default ProfileSettingAbout;
