import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useRoute } from "@react-navigation/native";
import { SCREENS } from '../../common/constant/index';

import SyncSelectionScreen from "./sync_selection_screen";
import SyncIntro from "./sync_intro";
import SyncScreen from "./sync_screen";

const Stack = createNativeStackNavigator();

const SyncStack = () => {
  const route = useRoute();
  const params = route.params as
    | { name?: string; companionId?: string }
    | undefined;
  const boundName = params?.name?.trim();
  const hasPerson = Boolean(boundName || params?.companionId);

  return (
    <Stack.Navigator
      initialRouteName={
        hasPerson ? SCREENS.SYNC_SCREEN : SCREENS.SYNC_SELECTION_SCREEN
      }
    >
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
        initialParams={hasPerson ? { name: boundName } : undefined}
      />
    </Stack.Navigator>
  );
};

export default SyncStack;
