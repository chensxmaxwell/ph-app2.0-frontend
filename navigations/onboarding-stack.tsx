import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { COMMON_HEADER_OPTIONS_CONFIG, SCREENS } from '../src/common/constant';
import { OnBoardingStep1 } from '../src/screens/onboarding/OnBoardingStep1';
import { OnBoardingStep4 } from '../src/screens/onboarding/OnBoardingStep4';
import { OnBoardingStep6 } from '../src/screens/onboarding/OnBoardingStep6';
import { ConnectDevice } from '../src/screens/onboarding/ConnectDevice';
import { OnBoardingStep2 } from '../src/screens/onboarding/OnBoardingStep2';
import { OnBoardingStep3 } from '../src/screens/onboarding/OnBoardingStep3';
import { OnBoardingStep5 } from '../src/screens/onboarding/OnBoardingStep5';
import { OnBoardingStep7 } from '../src/screens/onboarding/OnBoardingStep7';
import { PairDeviceScreen } from '../src/screens/onboarding/pairing';
import { UserFeedbackScreen } from '../src/screens/onboarding/feedback';


const Stack = createNativeStackNavigator();

export const OnboardingStack = () => (
  <Stack.Navigator
    initialRouteName={SCREENS.ONBOARDING_STEP1}
    screenOptions={COMMON_HEADER_OPTIONS_CONFIG}>
    <Stack.Screen
      name={SCREENS.ONBOARDING_STEP1}
      component={OnBoardingStep1}
    />
    <Stack.Screen
      name={SCREENS.ONBOARDING_STEP2}
      component={OnBoardingStep2}
    />
    <Stack.Screen
      name={SCREENS.ONBOARDING_STEP3}
      component={OnBoardingStep3}
    />
    <Stack.Screen
      name={SCREENS.ONBOARDING_STEP4}
      component={OnBoardingStep4}
    />
    <Stack.Screen
      name={SCREENS.ONBOARDING_STEP5}
      component={OnBoardingStep5}
    />

    <Stack.Screen
      name={SCREENS.ONBOARDING_STEP6}
      component={OnBoardingStep6}
    />
    <Stack.Screen
      name={SCREENS.ONBOARDING_STEP7}
      component={OnBoardingStep7}
    />
    <Stack.Screen
      name={SCREENS.CONNECT_DEVICE}
      component={ConnectDevice}
    />
    <Stack.Screen
      name={SCREENS.PAIR_BAND_APP}
      component={PairDeviceScreen}
      initialParams={{ step: "band-app" }}
    />
    <Stack.Screen
      name={SCREENS.PAIR_BAND_POWER}
      component={PairDeviceScreen}
      initialParams={{ step: "band-power" }}
    />
    <Stack.Screen
      name={SCREENS.PAIR_TOY_POWER}
      component={PairDeviceScreen}
      initialParams={{ step: "toy-power" }}
    />
    <Stack.Screen
      name={SCREENS.PAIR_TOY_MATCH}
      component={PairDeviceScreen}
      initialParams={{ step: "toy-match" }}
    />
    <Stack.Screen
      name={SCREENS.USER_FEEDBACK}
      component={UserFeedbackScreen}
    />

  </Stack.Navigator>
);