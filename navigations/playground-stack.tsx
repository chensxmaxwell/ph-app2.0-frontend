import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COMMON_HEADER_OPTIONS_CONFIG, SCREENS } from "../src/common/constant";
import { DisplayPatternScreenProps } from "../src/screens/control/sub-screens/pattern/sub-screens/play-pattern";
import { Playground } from "../src/screens/playground";
import MotionStack from "../src/screens/motion/motion-stack";
import { Canvas } from "../src/screens/control/sub-screens/canvas";
import AlarmStack from "../src/screens/Alarm/AlarmStack";
import BlissStack from "../src/screens/quick_bliss/bliss_stack";
import DeepDiscoveryStack from "../src/screens/deep_discovery/deep_discovery_stack";
import SoundStack from "../src/screens/sound/SoundStack";

const Stack = createNativeStackNavigator<HomeStackScreenProps>();

export const PlaygroundStack = () => (
  <Stack.Navigator
    initialRouteName={SCREENS.PLAYGROUND}
    screenOptions={COMMON_HEADER_OPTIONS_CONFIG}
  >
    <Stack.Screen name={SCREENS.PLAYGROUND} component={Playground} />
    <Stack.Screen name={SCREENS.MOTION_STACK} component={MotionStack} />
    <Stack.Screen name={SCREENS.CANVAS} component={Canvas} />
    <Stack.Screen name={SCREENS.ALARM_STACK} component={AlarmStack} />
    <Stack.Screen name={SCREENS.BLISS_STACK} component={BlissStack} />
    <Stack.Screen name={SCREENS.SOUND} component={SoundStack} />
    <Stack.Screen
      name={SCREENS.DEEP_DISCOVERY_STACK}
      component={DeepDiscoveryStack}
    />
  </Stack.Navigator>
);

export type HomeStackScreenProps = {
  NavBar: undefined;
  Manual: undefined;
  Pattern: undefined;
  Kink: undefined;
  DisplayPattern: DisplayPatternScreenProps;
  CreatePattern: undefined;
  Playground: undefined;
};
