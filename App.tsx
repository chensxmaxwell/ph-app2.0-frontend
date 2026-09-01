/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import {
  NavigationContainer,
  NavigationProp,
  ParamListBase,
} from "@react-navigation/native";
import { COMMON_HEADER_OPTIONS_CONFIG, SCREENS } from "./src/common/constant";
import { hydrateSession } from "./src/backend/session";
import { prepareLoveSessionBoot } from "./src/screens/love/session-persist";
import { AuthStack } from "./navigations/auth-stack";
import { ApolloProvider } from "@apollo/client";
import client from "./src/apolloClient";
import { HomeStack } from "./navigations/home-stack";
import { GlobalProvider } from "./src/store";
import { OnboardingStack } from "./navigations/onboarding-stack";
import { CustomAlert } from "@common/components/custom-alert";
import { AppProvider } from "./src/screens/kink/kink-context";
import { HomeScreenProvider } from "./src/hooks/HomeScreenContext";
import { DeviceProvider } from "./src/store/device";
import { AlarmRunner } from "./src/store/AlarmRunner";
import { CompanionsProvider } from "./src/store/companions";
import { LoveSessionProvider } from "./src/screens/love/session";
import { ChatProvider } from "./src/screens/chat/store";
import { TtsHost } from "./src/services/TtsHost";
import { AvatarEngineHost } from "./src/screens/avatar/engine/AvatarEngineHost";
import { OpenAnimationScreen } from "./src/screens/auth/open-animation";

const Stack = createNativeStackNavigator();
function App(): React.JSX.Element {
  const [bootRoute, setBootRoute] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      hydrateSession().then(async (user) => {
        await prepareLoveSessionBoot(user?.id ?? null);
        return user;
      }),
      new Promise((resolve) => setTimeout(resolve, 1600)),
    ])
      .then(([user]) => {
        setBootRoute(user ? SCREENS.MAIN : SCREENS.AUTH);
      })
      .catch(() => {
        setBootRoute(SCREENS.AUTH);
      });
  }, []);

  if (!bootRoute) {
    return <OpenAnimationScreen />;
  }

  return (
    <ApolloProvider client={client}>
      <GlobalProvider>
        <AppProvider>
          <DeviceProvider>
          <HomeScreenProvider>
            <AlarmRunner />
            <CompanionsProvider>
              <LoveSessionProvider>
              <ChatProvider>
              <TtsHost />
              <NavigationContainer>
                <Stack.Navigator
                  initialRouteName={bootRoute}
                  screenOptions={COMMON_HEADER_OPTIONS_CONFIG}
                >
                  <Stack.Screen name={SCREENS.AUTH} component={AuthStack} />
                  <Stack.Screen name={SCREENS.MAIN} component={HomeStack} />
                  <Stack.Screen
                    name={SCREENS.ONBOARDING}
                    component={OnboardingStack}
                  />
                </Stack.Navigator>
              </NavigationContainer>
              <AvatarEngineHost />
              <CustomAlert />
              </ChatProvider>
              </LoveSessionProvider>
            </CompanionsProvider>
          </HomeScreenProvider>
          </DeviceProvider>
        </AppProvider>
      </GlobalProvider>
    </ApolloProvider>
  );
}

export default App;

export type NavigationType = NavigationProp<ParamListBase>;
