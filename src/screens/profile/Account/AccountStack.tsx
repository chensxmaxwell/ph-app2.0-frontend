import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AccountScreen from "./Account";
import ResetPasswordStack from "./RestPasswordStack";
import ResetEmailStack from "./ResetEmailStack";
import { NavigationType } from "../../../../App";
import { SCREENS } from "../../../common/constant/index";

const Stack = createNativeStackNavigator();

const AccountStack = () => {
  return (
    <Stack.Navigator initialRouteName={SCREENS.PROFILE_SETTING_ACCOUNT_MAIN}>
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_MAIN}
        component={AccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_PASSWORD_STACK}
        component={ResetPasswordStack}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.PROFILE_SETTING_ACCOUNT_RESET_EMAIL_STACK}
        component={ResetEmailStack}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AccountStack;
