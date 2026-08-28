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
import { NavigationType } from "../../../App";

const ProfileSettingPrivacy = () => {
  const navigation = useNavigation<NavigationType>();

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Privacy & security</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>How we treat your data</Text>
        <Text style={styles.content}>
          Pleasure House is built for private play. Your profile, companions,
          chats, and device settings stay on this phone unless you choose to
          sign in and sync them.
        </Text>
        <Text style={styles.content}>
          If you use Bypass or stay signed out, we do not create an account for
          you. Conversations and companions on this device are local. Deleting
          the app removes them from the phone.
        </Text>
        <Text style={styles.content}>
          When you sign in, we store the minimum needed to keep your account
          working: your display name, saved companions, and chat history you
          want to keep. We do not sell this data, and we do not use it for ads.
        </Text>
        <Text style={styles.content}>
          Device connection uses Bluetooth on your phone. We do not read
          unrelated Bluetooth traffic. Microphone and photo access are only
          used when you start a voice feature or pick an image yourself.
        </Text>
        <Text style={styles.content}>
          You can sign out, delete a companion, or clear a chat at any time
          from Profile. If you want an account removed, contact us from the
          Contact page and we will delete the server copy.
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
    paddingBottom: 100,
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
    fontFamily: "Quicksand-Regular",
    color: colors.white,
    lineHeight: 24,
    marginTop: 20,
  },
});

export default ProfileSettingPrivacy;
