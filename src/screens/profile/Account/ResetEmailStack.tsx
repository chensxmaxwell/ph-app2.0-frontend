import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ResetEmailScreen from "./ResetEmail";
import ResetEmailVerificationScreen from "./ResetEmailVerification";
import ResetEmailSuccessScreen from "./ResetEmailSuccess";
import { SCREENS } from "@common/constant";

const Stack = createNativeStackNavigator();

const ResetEmailStack = () => {
  return (
    <Stack.Navigator
      initialRouteName={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_EMAIL}
    >
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_EMAIL}
        component={ResetEmailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_EMAIL_VERIFICATION}
        component={ResetEmailVerificationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_EMAIL_SUCCESS}
        component={ResetEmailSuccessScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default ResetEmailStack;
