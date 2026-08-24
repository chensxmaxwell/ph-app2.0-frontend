import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from '../../common/constant/index';

import SyncSelectionScreen from "./sync_selection_screen";
import SyncIntro from "./sync_intro";
import SyncScreen from "./sync_screen";

const Stack = createNativeStackNavigator();

const SyncStack = () => {
    return (
      <Stack.Navigator initialRouteName={SCREENS.SYNC_SELECTION_SCREEN}>
        <Stack.Screen
          name={SCREENS.SYNC_SELECTION_SCREEN}
          component={SyncSelectionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={SCREENS.SYNC_INTRODUCTION}
          component={SyncIntro}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={SCREENS.SYNC_SCREEN}
          component={SyncScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  };
  
  export default SyncStack;
  