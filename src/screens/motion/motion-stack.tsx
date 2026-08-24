import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from "../../common/constant/index";

import MotionSensorScreen from "./motion-sensor";
import MotionIntroScreen from "./motion-introduction";

const Stack = createNativeStackNavigator();

const MotionStack: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName={SCREENS.MOTION_SENSOR}>
      <Stack.Screen
        name={SCREENS.MOTION_SENSOR}
        component={MotionSensorScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={SCREENS.MOTION_INTRODUCTION}
        component={MotionIntroScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default MotionStack;
