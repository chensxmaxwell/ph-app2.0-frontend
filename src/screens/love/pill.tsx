import React from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { lookFromCompanion, useCompanions } from "../../store/companions";
import { useChat } from "../chat/store";
import { LookFace } from "../avatar/look-face";
import { s } from "../avatar/scale";
import { faceSourceForId } from "../chat/faces";
import { applyLoveLayer, getHomeStackNavigation, restoreLoveOverlays } from "./overlay";
import {
  LovePersonParams,
  loveMessagesFromThread,
  resolveLovePerson,
} from "./partner";
import { useLoveSession } from "./session";

export type LoveChatParams = LovePersonParams;

export const useOpenLove = () => {
  const navigation = useNavigation();
  const { activeCompanion, companions, setActiveCompanionId } = useCompanions();
  const { threads } = useChat();
  const { start, restore, minimized, companionId, layer, chat } =
    useLoveSession();

  return (params?: LoveChatParams) => {
    const requestedId = params?.companionId?.trim();
    const person = resolveLovePerson({
      companionId: requestedId || activeCompanion?.id || companionId,
      name: params?.name,
      companions,
      threads,
      activeCompanion,
      chatName: chat?.name,
    });
    if (person.companionId) {
      setActiveCompanionId(person.companionId);
    }

    const switching = Boolean(
      person.companionId && companionId && person.companionId !== companionId
    );
    const nav =
      getHomeStackNavigation() ?? (navigation as NavigationProp<ParamListBase>);

    if (
      minimized &&
      !switching &&
      !params?.syncing &&
      (!requestedId || requestedId === companionId)
    ) {
      restore();
      restoreLoveOverlays(nav, layer, person.companionId, person.name);
      return;
    }

    start({
      layer: params?.syncing ? "sync" : "chat",
      companionId: person.companionId,
      name: person.name,
      personality: person.personality,
      story: person.story,
      messages: loveMessagesFromThread(person.thread),
      fromCreation: params?.fromCreation,
      syncing: params?.syncing,
      replace: switching,
    });
    const overlayParams = {
      companionId: person.companionId,
      name: person.name,
      fromCreation: params?.fromCreation,
      syncing: params?.syncing,
    };
    applyLoveLayer(nav, {
      layer: params?.syncing ? "sync" : "chat",
      params: overlayParams,
      surface: params?.fromMessage && params.syncing ? "message" : "love",
    });
  };
};

type LovePillProps = {
  onPress?: () => void;
  style?: ViewStyle;
};

export const LovePill = ({ onPress, style }: LovePillProps) => {
  const openLove = useOpenLove();
  const { companions, activeCompanion } = useCompanions();
  const { companionId } = useLoveSession();
  const companion =
    companions.find((item) => item.id === companionId) ??
    companions.find((item) => item.id === activeCompanion?.id);
  const look = companion ? lookFromCompanion(companion) : null;
  const personId = companionId ?? activeCompanion?.id;

  return (
    <TouchableOpacity
      style={[styles.pill, style]}
      onPress={onPress ?? (() => openLove({ companionId: personId }))}
      activeOpacity={0.85}
    >
      <LookFace
        look={look}
        size={s(37)}
        fallbackSource={faceSourceForId(personId)}
      />
    </TouchableOpacity>
  );
};

export const SessionLovePill = ({ style }: { style?: ViewStyle }) => {
  const navigation = useNavigation();
  const { minimized, layer, companionId, chat, restore } = useLoveSession();

  if (!minimized) {
    return null;
  }

  return (
    <LovePill
      style={style}
      onPress={() => {
        restore();
        const homeNav = getHomeStackNavigation();
        restoreLoveOverlays(
          homeNav ?? (navigation as NavigationProp<ParamListBase>),
          layer,
          companionId,
          chat?.name
        );
      }}
    />
  );
};

export const GlobalSessionLovePill = () => (
  <View pointerEvents="box-none" collapsable={false} style={styles.host}>
    <SessionLovePill />
  </View>
);

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  pill: {
    position: "absolute",
    right: s(-27),
    top: s(127),
    width: s(84),
    height: s(53),
    borderRadius: s(26.5),
    backgroundColor: colors.grayLightest,
    justifyContent: "center",
    paddingLeft: s(10),
    zIndex: 20,
  },
  face: {
    width: s(37),
    height: s(37),
    borderRadius: s(18.5),
  },
});
