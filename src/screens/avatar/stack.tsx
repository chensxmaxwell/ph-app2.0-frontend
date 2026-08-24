import React, { useMemo } from "react";
import { RouteProp, useRoute } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COMMON_HEADER_OPTIONS_CONFIG, SCREENS } from "@common/constant";
import { useChat } from "../chat/store";
import { useCompanions } from "../../store/companions";
import {
  AvatarWizardProvider,
  DEFAULT_DRAFT,
  draftFromCompanion,
  toGenderOption,
} from "./context";
import { AvatarIdentityScreen } from "./identity";
import { AvatarReadyScreen } from "./ready";
import { AvatarAppearanceScreen } from "./appearance";
import { AvatarCustomizeScreen } from "./customize";
import { AvatarPersonalityScreen } from "./personality";
import { AvatarStoryScreen } from "./story";
import { AvatarIntimateScreen } from "./intimate";
import { AvatarCandleScreen } from "./candle";
import { AvatarWaitingScreen } from "./waiting";
import { AvatarStackParams, WizardMode } from "./types";

const Stack = createNativeStackNavigator();

const initialRouteFor = (mode: WizardMode) => {
  switch (mode) {
    case "create":
      return SCREENS.AVATAR_IDENTITY;
    case "editLook":
      return SCREENS.AVATAR_APPEARANCE;
    case "editPersona":
      return SCREENS.AVATAR_IDENTITY;
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
};

export const AvatarStack = () => {
  const route = useRoute<RouteProp<Record<string, AvatarStackParams>, string>>();
  const params = route.params ?? {};
  const mode: WizardMode = params.mode ?? "create";
  const { companions } = useCompanions();
  const { getThread } = useChat();
  const companion = params.companionId
    ? companions.find((item) => item.id === params.companionId)
    : undefined;
  const thread = !companion && params.companionId
    ? getThread(params.companionId)
    : undefined;
  const fallbackId = useMemo(() => `companion-${Date.now()}`, []);
  const companionId = params.companionId ?? fallbackId;
  const initialDraft = companion
    ? draftFromCompanion(companion)
    : thread
    ? {
        ...DEFAULT_DRAFT,
        name: thread.name,
        birthday: thread.birthday ?? "",
        gender: toGenderOption(thread.gender ?? "Male"),
        story: thread.description ?? "",
      }
    : DEFAULT_DRAFT;
  const sessionKey = `${mode}:${companionId}`;

  return (
    <AvatarWizardProvider
      key={sessionKey}
      mode={mode}
      companionId={companionId}
      initialDraft={initialDraft}
    >
      <Stack.Navigator
        key={sessionKey}
        initialRouteName={initialRouteFor(mode)}
        screenOptions={COMMON_HEADER_OPTIONS_CONFIG}
      >
        <Stack.Screen
          name={SCREENS.AVATAR_IDENTITY}
          component={AvatarIdentityScreen}
        />
        <Stack.Screen name={SCREENS.AVATAR_READY} component={AvatarReadyScreen} />
        <Stack.Screen
          name={SCREENS.AVATAR_APPEARANCE}
          component={AvatarAppearanceScreen}
        />
        <Stack.Screen
          name={SCREENS.AVATAR_CUSTOMIZE}
          component={AvatarCustomizeScreen}
        />
        <Stack.Screen
          name={SCREENS.AVATAR_PERSONALITY}
          component={AvatarPersonalityScreen}
        />
        <Stack.Screen name={SCREENS.AVATAR_STORY} component={AvatarStoryScreen} />
        <Stack.Screen
          name={SCREENS.AVATAR_INTIMATE}
          component={AvatarIntimateScreen}
        />
        <Stack.Screen
          name={SCREENS.AVATAR_CANDLE}
          component={AvatarCandleScreen}
        />
        <Stack.Screen
          name={SCREENS.AVATAR_WAITING}
          component={AvatarWaitingScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </AvatarWizardProvider>
  );
};
