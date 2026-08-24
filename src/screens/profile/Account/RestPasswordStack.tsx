import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ResetPwdEmailVerificationScreen from "./ResetPwdEmailVerification";
import ResetPasswordScreen from "./ResetPassword";
import ResetPasswordSuccessScreen from "./ResetPasswordSuccess";
import { SCREENS } from "@common/constant";

const Stack = createNativeStackNavigator();

const ResetPasswordStack = () => {
  return (
    <Stack.Navigator
      initialRouteName={
        SCREENS.PROFILE_SETTING_ACCOUNT_RESET_PASSWORD_EMAIL_VERIFICATION
      }
    >
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_PASSWORD_EMAIL_VERIFICATION}
        component={ResetPwdEmailVerificationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_PASSWORD}
        component={ResetPasswordScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_PASSWORD_SUCCESS}
        component={ResetPasswordSuccessScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default ResetPasswordStack;
