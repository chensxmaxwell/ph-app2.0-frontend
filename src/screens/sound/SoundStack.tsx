import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from '../../common/constant/index';

import SoundIntroductionScreen from "./SoundIntro";

const SoundMeterScreen = () => {
  // Load only when Sound opens. Importing SoundMeter at HomeStack startup
  // pulls in react-native-audio-recorder-player, which registers a
  // process-wide AVAudioSession interruption observer.
  const SoundLevelMonitor = require("./SoundMeter").default;
  return <SoundLevelMonitor />;
};

const Stack = createNativeStackNavigator();

const SoundStack = () => {
    return (
      <Stack.Navigator initialRouteName={SCREENS.SOUND_METER}>
        <Stack.Screen
          name={SCREENS.SOUND_METER}
          component={SoundMeterScreen}
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
  