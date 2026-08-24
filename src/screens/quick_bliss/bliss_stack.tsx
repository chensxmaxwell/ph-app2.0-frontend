import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from "../../common/constant/index";

import SliderScreen from "./slider_screen";
import TimerScreen from "./timer_screen";
import { QuickBlissContext } from "./quick-bliss-context";

const Stack = createNativeStackNavigator();

const BlissStack = () => {
  return (
    <QuickBlissContext>
      <Stack.Navigator initialRouteName={SCREENS.QUICK_BLISS_SLIDER}>
        <Stack.Screen
          name={SCREENS.QUICK_BLISS_SLIDER}
          component={SliderScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={SCREENS.BLISS_TIMER}
          component={TimerScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </QuickBlissContext>
  );
};

export default BlissStack;
