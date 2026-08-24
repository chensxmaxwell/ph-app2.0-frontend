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

const ProfileSettingAbout = () => {
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
      <View>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Title</Text>
          <Text style={styles.content}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Fames ac
            turpis egestas maecenas pharetra convallis posuere. Pellentesque sit
            amet porttitor eget dolor morbi non. Tincidunt augue interdum velit
            euismod. Lacus luctus accumsan tortor posuere. Est sit amet
            facilisis magna etiam tempor. Nec ullamcorper sit amet risus nullam
            eget felis eget. Cras sed felis eget velit aliquet. Nam aliquam sem
            et tortor consequat id porta nibh. Consectetur libero id faucibus
            nisl tincidunt eget nullam non. Volutpat commodo sed egestas egestas
            fringilla. Habitant morbi tristique senectus et netus. Tellus at
            urna condimentum mattis. Mi tempus imperdiet nulla malesuada. Eget
            sit amet tellus cras. Eget est lorem ipsum dolor sit amet
            consectetur adipiscing elit. In mollis nunc sed id semper risus.
          </Text>
          <Text style={styles.content}>
            Dolor magna eget est lorem ipsum dolor sit amet. Velit ut tortor
            pretium viverra suspendisse potenti nullam ac tortor. Imperdiet
            proin fermentum leo vel. Leo urna molestie at elementum eu
            facilisis. At elementum eu facilisis sed odio morbi. Et sollicitudin
            ac orci phasellus. Odio euismod lacinia at quis. Suspendisse
            interdum consectetur libero id faucibus nisl tincidunt eget. Tempus
            iaculis urna id volutpat lacus laoreet non curabitur gravida.
          </Text>
        </ScrollView>
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
    fontSize: fontSizes.small,
    fontFamily: "OpenSans-Regular",
    color: colors.white,
    lineHeight: 24,
    marginTop: 20,
    textAlign: "justify",
  },
});

export default ProfileSettingAbout;
