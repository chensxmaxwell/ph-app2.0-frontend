import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useEffect, useState } from "react";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { useNavigation } from "@react-navigation/native";
import ChevronRight from "@images/chevron-right-white.svg";
import LinearGradient from "react-native-linear-gradient";
import { SCREENS } from "@common/constant";
import { NavigationType } from "../../../App";
import { useProfile } from "./hooks";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MenuScreen = () => {
  const navigation = useNavigation<NavigationType>();
  const { user, profile, formatDate } = useProfile();

  const rootNavigation = () => {
    let current = navigation as NavigationType;
    let parent = navigation.getParent();
    while (parent) {
      current = parent as NavigationType;
      parent = current.getParent();
    }
    return current;
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("user");
    rootNavigation().reset({
      index: 0,
      routes: [{ name: SCREENS.AUTH }],
    });
  };

  const openPremium = () => {
    navigation.getParent()?.getParent()?.navigate(SCREENS.PREMIUM);
  };

  return (
    <ScrollView style={styles.container}>
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
      <LinearGradient
        style={styles.rectangleLineargradient}
        locations={[0, 1]}
        colors={["rgba(108, 108, 108, 0.6)", "rgba(33, 33, 33, 0.6)"]}
        useAngle={true}
        angle={180}
      >
        <Image
          style={styles.backgroundImage}
          source={require("../../../assets/images/girl.png")}
        />
      </LinearGradient>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Image
          style={styles.profileImage}
          source={require("../../../assets/images/Avatar_default.png")}
        />
        <Text style={styles.nameText}>{profile?.name ?? "Loading..."}</Text>
        <Text style={styles.emailText}>{user?.email ?? "Loading..."}</Text>
      </View>

      {/* Buttons Section */}
      <View style={styles.infoSection}>
        <View style={styles.button}>
          <Text style={styles.buttonText}>Female</Text>
        </View>
        <View style={styles.button}>
          <Text style={styles.buttonText}>{formatDate(profile.birthday)}</Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate(SCREENS.PROFILE_EDIT)}
        >
          <Text style={styles.buttonText}>Edit profile</Text>
          <ChevronRight style={styles.chevron} />
        </TouchableOpacity>
      </View>

      {/* Free plan and Go Premium Section */}
      <View style={styles.planSection}>
        <View style={styles.planTextWrapper}>
          <Text style={styles.planText}>Free plan</Text>
        </View>
        <TouchableOpacity style={styles.goPremiumButton} onPress={openPremium}>
          <Text style={styles.goPremiumText}>Go Premium</Text>
          <ChevronRight style={styles.chevron} />
        </TouchableOpacity>
      </View>

      {/* General Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        <TouchableOpacity
          style={styles.sectionItem}
          onPress={() => navigation.navigate(SCREENS.PROFILE_DEVICE_TRAINING)}
        >
          <Text style={styles.sectionItemText}>
            My device training information
          </Text>
          <ChevronRight style={styles.chevron} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionItem}
          onPress={() => navigation.navigate(SCREENS.PROFILE_SETTING_ACCOUNT)}
        >
          <Text style={styles.sectionItemText}>Account</Text>
          <ChevronRight style={styles.chevron} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionItem}
          onPress={() => navigation.navigate(SCREENS.PROFILE_LLM)}
        >
          <Text style={styles.sectionItemText}>Companion AI</Text>
          <ChevronRight style={styles.chevron} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionItem}
          onPress={() => navigation.navigate(SCREENS.TUTORIAL)}
        >
          <Text style={styles.sectionItemText}>Tutorial</Text>
          <ChevronRight style={styles.chevron} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionItem}
          onPress={() => navigation.navigate(SCREENS.PROFILE_SETTING_LANGUAGE)}
        >
          <Text style={styles.sectionItemText}>Language</Text>
          <ChevronRight style={styles.chevron} />
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <TouchableOpacity
          style={styles.sectionItem}
          onPress={() => navigation.navigate(SCREENS.PROFILE_SETTING_ABOUTUS)}
        >
          <Text style={styles.sectionItemText}>About us</Text>
          <ChevronRight width={20} height={20} style={styles.chevron} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionItem}
          onPress={() => navigation.navigate(SCREENS.PROFILE_SETTING_HELP)}
        >
          <Text style={styles.sectionItemText}>Contact</Text>
          <ChevronRight width={20} height={20} style={styles.chevron} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionItem}
          onPress={() => navigation.navigate(SCREENS.PROFILE_SETTING_PRIVACY)}
        >
          <Text style={styles.sectionItemText}>Privacy & security</Text>
          <ChevronRight width={20} height={20} style={styles.chevron} />
        </TouchableOpacity>
      </View>

      {/* Logout Section */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate(SCREENS.SWITCH_ACCOUNTS)}>
          <Text style={styles.switchAccountText}>Switch accounts</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  rectangleLineargradient: {
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 30,
    flex: 1,
    width: "100%",
    height: 373,
    backgroundColor: "transparent",
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
  },
  headerSection: {
    alignItems: "center",
    marginTop: -50,
    paddingBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  nameText: {
    fontSize: fontSizes.largeX,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
  },
  emailText: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
  },
  infoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingHorizontal: 32,
  },
  button: {
    backgroundColor: colors.grayLightest,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    flexDirection: "row", // 让文字和图标在一行显示
    justifyContent: "space-between", // 让文字和图标分开
    alignItems: "center",
  },
  buttonText: {
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
  chevron: {
    paddingRight: 0,
  },
  /* Plan section for Free Plan and Go Premium */
  planSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.grayLightest,
    borderRadius: 25,
    marginHorizontal: 32,
    paddingHorizontal: 16,
    marginTop: 20,
    height: 40,
  },
  planTextWrapper: {
    flex: 1,
  },
  planText: {
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    fontWeight: fontWeights.bold,
  },
  goPremiumButton: {
    paddingVertical: 10,
    flexDirection: "row", // 让文字和图标在一行显示
    alignItems: "center",
  },
  goPremiumText: {
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    fontWeight: fontWeights.bold,
  },
  section: {
    marginTop: 30,
    paddingHorizontal: 32,
  },
  sectionTitle: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    marginBottom: 10,
  },
  sectionItem: {
    paddingVertical: 15,
    flexDirection: "row", // 让文字和图标在一行显示
    justifyContent: "space-between", // 让文字和图标分开
    alignItems: "center",
  },
  sectionItemText: {
    fontSize: fontSizes.small,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
  },
  logoutSection: {
    marginTop: 30,
    marginBottom: 100,
    alignItems: "center",
    paddingHorizontal: 48,
  },
  logoutButton: {
    backgroundColor: colors.grayLightest,
    paddingVertical: 10,
    width: "100%",
    borderRadius: 25,
    marginBottom: 10,
    height: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
  },
  switchAccountText: {
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.white,
  },
});

export default MenuScreen;
