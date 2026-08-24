import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from '../../common/constant/index';

import MenuScreen from "./Menu";
import ProfileSettingAbout from "./ProfileSettingAbout";
import ProfileSettingContact from "./ProfileSettingContact";
import ProfileSettingPrivacy from "./ProfileSettingPrivacy";
import DeviceTrainingScreen from "./DeviceTraining";
import EditProfileScreen from "./EditProfile";
import AccountStack from "./Account/AccountStack";
import { Screen } from "react-native-screens";
import LanguageScreen from "./Language";
import { TutorialScreen } from "./Tutorial";
import { SwitchAccountsScreen } from "./SwitchAccounts";
import { CompanionAiScreen } from "./CompanionAi";

const Stack = createNativeStackNavigator();

const ProfileStack = () => {
  return (
    <Stack.Navigator initialRouteName={SCREENS.PROFILEMAIN}>
      <Stack.Screen
        name={SCREENS.PROFILEMAIN}
        component={MenuScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_EDIT}
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_DEVICE_TRAINING}
        component={DeviceTrainingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT}
        component={AccountStack}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_LANGUAGE}
        component={LanguageScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ABOUTUS}
        component={ProfileSettingAbout}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_HELP}
        component={ProfileSettingContact}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_PRIVACY}
        component={ProfileSettingPrivacy}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.TUTORIAL}
        component={TutorialScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.SWITCH_ACCOUNTS}
        component={SwitchAccountsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_LLM}
        component={CompanionAiScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default ProfileStack;
