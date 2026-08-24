import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from "../../common/constant/index";

import SliderScreen from "./slider_screen";
import TimerScreen from "./timer_screen";
import { DeepDiscoverContext } from "./deep-discover-context";

const Stack = createNativeStackNavigator();

const DeepDiscoveryStack = () => {
  return (
    <DeepDiscoverContext>
      <Stack.Navigator initialRouteName={SCREENS.DEEP_DISCOVERY_SLIDER}>
        <Stack.Screen
          name={SCREENS.DEEP_DISCOVERY_SLIDER}
          component={SliderScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={SCREENS.DEEP_DISCOVERY_TIMER}
          component={TimerScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </DeepDiscoverContext>
  );
};

export default DeepDiscoveryStack;
