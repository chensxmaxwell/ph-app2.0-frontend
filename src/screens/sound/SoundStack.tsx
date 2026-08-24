import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from '../../common/constant/index';

import SoundIntroductionScreen from "./SoundIntro";
import SoundLevelMonitor from "./SoundMeter";

const Stack = createNativeStackNavigator();

const SoundStack = () => {
    return (
      <Stack.Navigator initialRouteName={SCREENS.SOUND_METER}>
        <Stack.Screen
          name={SCREENS.SOUND_METER}
          component={SoundLevelMonitor}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={SCREENS.SOUND_INTRO}
          component={SoundIntroductionScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  };
  
  export default SoundStack;
  