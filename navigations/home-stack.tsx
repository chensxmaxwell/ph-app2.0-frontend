import React from "react";
import { StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COMMON_HEADER_OPTIONS_CONFIG, SCREENS } from "../src/common/constant";
import { GlobalSessionLovePill } from "../src/screens/love/pill";
import { bindHomeStackNavigation } from "../src/screens/love/overlay";
import { NavBar } from "@common/components/nav-bar/nav-bar";
import { Manual } from "../src/screens/control/sub-screens/manual";
import { Pattern } from "../src/screens/control/sub-screens/pattern";
import { CreatePattern } from "../src/screens/control/sub-screens/pattern/sub-screens/create-pattern";
import {
  DisplayPatternScreenProps,
  PlayPattern,
} from "../src/screens/control/sub-screens/pattern/sub-screens/play-pattern";
import { PlaygroundStack } from "./playground-stack";
import KinkStack from "../src/screens/kink/kink-stack";
import { KinkHub } from "../src/screens/control/sub-screens/kink";
import { SavePattern } from "../src/screens/control/sub-screens/pattern/sub-screens/save-pattern";
import { NewPattern } from "../src/screens/control/sub-screens/pattern/sub-screens/new-pattern";
import { ConnectDevice } from "../src/screens/onboarding/ConnectDevice";
import { AvatarStack } from "../src/screens/avatar/stack";
import { LoveChatScreen } from "../src/screens/love/chat";
import { LoveCallScreen } from "../src/screens/love/call";
import { LoveSyncScreen } from "../src/screens/love/sync";
import { ChatThreadScreen } from "../src/screens/chat/thread";
import { ChatSearchScreen } from "../src/screens/chat/search";
import { ChatSettingsScreen } from "../src/screens/chat/settings";
import { ChatCreateScreen } from "../src/screens/chat/create";
import { ChatContactScreen } from "../src/screens/chat/contact";
import { ChatCallScreen } from "../src/screens/chat/call";
import SyncStack from "../src/screens/sync/sync_stack";
import BlissStack from "../src/screens/quick_bliss/bliss_stack";
import { AutoScreen } from "../src/screens/control/auto";
import { PerformanceScreen } from "../src/screens/home/performance";
import { PerformancePlayScreen } from "../src/screens/home/performance-play";
import { FeedScreen } from "../src/screens/home/feed";
import { PremiumScreen } from "../src/screens/profile/Premium";

const Stack = createNativeStackNavigator<HomeStackScreenProps>();

export const HomeStack = () => (
  <View style={styles.root}>
    <Stack.Navigator
      initialRouteName={SCREENS.NAV_BAR}
      screenOptions={COMMON_HEADER_OPTIONS_CONFIG}
      screenListeners={({ navigation }) => {
        bindHomeStackNavigation(navigation);
        return {};
      }}
    >
    <Stack.Screen name={SCREENS.NAV_BAR} component={NavBar} />
    <Stack.Screen name={SCREENS.MANUAL} component={Manual} />
    <Stack.Screen name={SCREENS.PATTERN} component={Pattern} />
    <Stack.Screen name={SCREENS.CREATE_PATTERN} component={CreatePattern} />
    <Stack.Screen name={SCREENS.SAVE_PATTERN} component={SavePattern} />
    <Stack.Screen name={SCREENS.NEW_PATTERN} component={NewPattern} />
    <Stack.Screen
      name={SCREENS.DISPLAY_PATTERN}
      component={PlayPattern}
      initialParams={{ pattern: [], title: "" }} // Provide default values for required props
    />
    <Stack.Screen name={SCREENS.KINK_HUB} component={KinkHub} />
    <Stack.Screen name={SCREENS.KINK} component={KinkStack} />
    <Stack.Screen name={SCREENS.PLAYGROUND_STACK} component={PlaygroundStack} />
    <Stack.Screen name={SCREENS.CONNECT_DEVICE} component={ConnectDevice} />
    <Stack.Screen name={SCREENS.AVATAR_STACK} component={AvatarStack} />
    <Stack.Screen
      name={SCREENS.LOVE_CHAT}
      component={LoveChatScreen}
      options={{
        animation: "fade",
        presentation: "transparentModal",
        contentStyle: { backgroundColor: "transparent" },
      }}
    />
    <Stack.Screen
      name={SCREENS.LOVE_CALL}
      component={LoveCallScreen}
      options={{
        animation: "fade",
        presentation: "transparentModal",
        contentStyle: { backgroundColor: "transparent" },
      }}
    />
    <Stack.Screen
      name={SCREENS.LOVE_SYNC}
      component={LoveSyncScreen}
      options={{
        animation: "fade",
        presentation: "transparentModal",
        contentStyle: { backgroundColor: "transparent" },
      }}
    />
    <Stack.Screen name={SCREENS.CHAT_THREAD} component={ChatThreadScreen} />
    <Stack.Screen name={SCREENS.CHAT_SEARCH} component={ChatSearchScreen} />
    <Stack.Screen name={SCREENS.CHAT_SETTINGS} component={ChatSettingsScreen} />
    <Stack.Screen name={SCREENS.CHAT_CREATE} component={ChatCreateScreen} />
    <Stack.Screen name={SCREENS.CHAT_CONTACT} component={ChatContactScreen} />
    <Stack.Screen
      name={SCREENS.CHAT_CALL}
      component={ChatCallScreen}
      options={{
        animation: "fade",
        presentation: "transparentModal",
        contentStyle: { backgroundColor: "transparent" },
      }}
    />
    <Stack.Screen name={SCREENS.SYNC_STACK} component={SyncStack} />
    <Stack.Screen name={SCREENS.BLISS_STACK} component={BlissStack} />
    <Stack.Screen name={SCREENS.AUTO} component={AutoScreen} />
    <Stack.Screen name={SCREENS.PERFORMANCE} component={PerformanceScreen} />
    <Stack.Screen
      name={SCREENS.PERFORMANCE_PLAY}
      component={PerformancePlayScreen}
    />
    <Stack.Screen name={SCREENS.FEED} component={FeedScreen} />
      <Stack.Screen name={SCREENS.PREMIUM} component={PremiumScreen} />
    </Stack.Navigator>
    <GlobalSessionLovePill />
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export type HomeStackScreenProps = {
  NavBar: undefined;
  Manual: undefined;
  Pattern: undefined;
  Kink: undefined;
  KinkHub: undefined;
  DisplayPattern: DisplayPatternScreenProps;
  CreatePattern: undefined;
  Playground: undefined;
  AvatarStack: undefined;
  LoveChat:
    | { companionId?: string; fromCreation?: boolean; syncing?: boolean }
    | undefined;
  LoveCall: { companionId?: string } | undefined;
  LoveSync: { companionId?: string } | undefined;
  ChatThread: { threadId: string };
  ChatSearch: { addFriends?: boolean } | undefined;
  ChatSettings: { threadId: string };
  ChatCreate: { threadId?: string } | undefined;
  ChatContact: { personId: string };
  ChatCall: { threadId: string };
  SyncStack: undefined;
  BlissStack: undefined;
  Auto: undefined;
  Performance: undefined;
  PerformancePlay: { title?: string } | undefined;
  Feed: undefined;
  Premium: undefined;
};
