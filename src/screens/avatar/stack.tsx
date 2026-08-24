import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COMMON_HEADER_OPTIONS_CONFIG, SCREENS } from "@common/constant";
import { AvatarWizardProvider } from "./context";
import { AvatarIdentityScreen } from "./identity";
import { AvatarReadyScreen } from "./ready";
import { AvatarAppearanceScreen } from "./appearance";
import { AvatarCustomizeScreen } from "./customize";
import { AvatarPersonalityScreen } from "./personality";
import { AvatarStoryScreen } from "./story";
import { AvatarIntimateScreen } from "./intimate";
import { AvatarCandleScreen } from "./candle";
import { AvatarWaitingScreen } from "./waiting";

const Stack = createNativeStackNavigator();

export const AvatarStack = () => (
  <AvatarWizardProvider>
    <Stack.Navigator
      initialRouteName={SCREENS.AVATAR_IDENTITY}
      screenOptions={COMMON_HEADER_OPTIONS_CONFIG}
    >
      <Stack.Screen
        name={SCREENS.AVATAR_IDENTITY}
        component={AvatarIdentityScreen}
      />
      <Stack.Screen name={SCREENS.AVATAR_READY} component={AvatarReadyScreen} />
      <Stack.Screen
        name={SCREENS.AVATAR_APPEARANCE}
        component={AvatarAppearanceScreen}
      />
      <Stack.Screen
        name={SCREENS.AVATAR_CUSTOMIZE}
        component={AvatarCustomizeScreen}
      />
      <Stack.Screen
        name={SCREENS.AVATAR_PERSONALITY}
        component={AvatarPersonalityScreen}
      />
      <Stack.Screen name={SCREENS.AVATAR_STORY} component={AvatarStoryScreen} />
      <Stack.Screen
        name={SCREENS.AVATAR_INTIMATE}
        component={AvatarIntimateScreen}
      />
      <Stack.Screen
        name={SCREENS.AVATAR_CANDLE}
        component={AvatarCandleScreen}
      />
      <Stack.Screen
        name={SCREENS.AVATAR_WAITING}
        component={AvatarWaitingScreen}
      />
    </Stack.Navigator>
  </AvatarWizardProvider>
);
