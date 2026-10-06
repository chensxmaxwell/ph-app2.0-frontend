import React from "react";
import { View, StyleSheet } from "react-native";
import { BottomTabBar, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import {
  AUTO_BAR_H,
  AutoBarHost,
  useAutoBarState,
} from "../../../screens/advanced-control/components/AutoBar";
import type { AutoBarState } from "../../../screens/advanced-control/model";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const Tab = createBottomTabNavigator();

const TabIcon = ({
  focused,
  Icon,
}: {
  focused: boolean;
  Icon: React.FC;
}) => (
  <View style={[styles.icon, focused ? styles.iconFocused : styles.iconIdle]}>
    <Icon />
  </View>
);

// ICD001-1 Auto bar docks on top of the tab bar; while it shows, the scenes
// lose AUTO_BAR_H at the bottom so it never covers page content.
export const NavBar = () => <NavBarTabs autoBar={useAutoBarState()} />;

// absolute host = the old `position: "absolute"` tab bar (scenes run under it)
const renderTabBar = (props: BottomTabBarProps) => (
  <AutoBarHost>
    <BottomTabBar {...props} />
  </AutoBarHost>
);

const NavBarTabs = ({ autoBar }: { autoBar: AutoBarState }) => (
  <Tab.Navigator
    sceneContainerStyle={autoBar ? { paddingBottom: AUTO_BAR_H } : undefined}
    tabBar={renderTabBar}
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.grayLightSolid,
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
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={House} />,
      }}
    />
    <Tab.Screen
      name={SCREENS.CONTROL}
      component={Control}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} Icon={JoyStick} />
        ),
      }}
    />
    <Tab.Screen
      name={SCREENS.CHAT}
      component={Chat}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} Icon={ChatCircle} />
        ),
      }}
    />
    <Tab.Screen
      name={SCREENS.PROFILE}
      component={ProfileStack}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} Icon={UserCircle} />
        ),
      }}
    />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconFocused: {
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  iconIdle: {
    opacity: 0.38,
    transform: [{ scale: 1 }],
  },
});
