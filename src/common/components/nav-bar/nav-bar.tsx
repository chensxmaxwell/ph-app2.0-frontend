import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home } from "../../../screens/home";
import { Control } from "../../../screens/control";
import { SCREENS } from "@common/constant";
import House from "@images/icons/house.svg";
import JoyStick from "@images/icons/joystick.svg";
import ChatCircle from "@images/icons/chat-circle.svg";
import UserCircle from "@images/icons/user-circle.svg";
import { colors } from "@common/styles/colors";
import ProfileStack from "../../../screens/profile/ProfileStack";
import { Chat } from "../../../screens/chat";

const Tab = createBottomTabNavigator();

export const NavBar = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.grayLightSolid,
        position: "absolute",
        borderTopWidth: 0, // Remove the top border
        elevation: 0, // Remove shadow on Android
      },
      tabBarLabel: () => null,
    }}
  >
    <Tab.Screen
      name={SCREENS.HOME}
      component={Home}
      options={{
        tabBarIcon: () => <House />,
      }}
    />
    <Tab.Screen
      name={SCREENS.CONTROL}
      component={Control}
      options={{
        tabBarIcon: () => <JoyStick />,
      }}
    />
    <Tab.Screen
      name={SCREENS.CHAT}
      component={Chat}
      options={{
        tabBarIcon: () => <ChatCircle />,
      }}
    />
    <Tab.Screen
      name={SCREENS.PROFILE}
      component={ProfileStack}
      options={{
        tabBarIcon: () => <UserCircle />,
      }}
    />
  </Tab.Navigator>
);
