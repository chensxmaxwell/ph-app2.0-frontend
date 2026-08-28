import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from "../../common/constant/index";

import KinkIntroScreen from "./kink-inro";
import EmotionSelectionScreen from "./kink-emotion-selection";
import IntensitySelectionScreen from "./kink-intensity-selection";
import SensitivitySelectionScreen from "./kink-sensitivity-selection";
import FunTypeSelectionScreen from "./funtype-screen";
import SaveKinkScreen from "./save_kink";
import WaitingScreen from "./waiting";
import KinkConfirmationScreen from "./kink-confirmation_screen";
import KinkPlayerScreen from "./kink-player-screen";

const Stack = createNativeStackNavigator();

const KinkStack = () => {
  return (
    <Stack.Navigator initialRouteName={SCREENS.KINK_EMOTIONSELECTION}>
      <Stack.Screen
        name={SCREENS.KINK_INTRO}
        component={KinkIntroScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.KINK_EMOTIONSELECTION}
        component={EmotionSelectionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.KINK_INTENSITY_SELECTION}
        component={IntensitySelectionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.KINK_SENSITIVITY_SELECTION}
        component={SensitivitySelectionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.KINK_FUNTYPE}
        component={FunTypeSelectionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.KINK_SAVE}
        component={SaveKinkScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.KINK_WAITING}
        component={WaitingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.KINK_CONFIRMATION}
        component={KinkConfirmationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.KINK_PLAY}
        component={KinkPlayerScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default KinkStack;
