import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from '../../common/constant/index';

import SetAlarmIntroductionScreen from "./setAlarmIntroduction";
import SetAlarmScreen from "./setAlarm";
import ChoosePatternScreen from "./PatternChoice";
import AlarmList from "./AlarmList";

const Stack = createNativeStackNavigator();

const AlarmStack = () => {
    return (
      <Stack.Navigator initialRouteName={SCREENS.SETALARM_INTRO}>
        <Stack.Screen
          name={SCREENS.SETALARM_INTRO}
          component={SetAlarmIntroductionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={SCREENS.SETALARM_TIME}
          component={SetAlarmScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={SCREENS.SETALARM_PATTERN}
          component={ChoosePatternScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={SCREENS.SETALARM_LIST}
          component={AlarmList}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  };
  
  export default AlarmStack;
  