import React from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import { lookFromCompanion, useCompanions } from "../../store/companions";
import { LookFace } from "../avatar/look-face";
import { s } from "../avatar/scale";
import { getHomeStackNavigation, restoreLoveOverlays } from "./overlay";
import { LovePersonParams, resolveLovePerson } from "./partner";
import { useLoveSession } from "./session";

export type LoveChatParams = LovePersonParams;

export const useOpenLove = () => {
  const navigation = useNavigation();
  const { activeCompanion, companions, setActiveCompanionId } = useCompanions();
  const { start, restore, minimized, companionId, layer, chat } =
    useLoveSession();

  return (params?: LoveChatParams) => {
    const person = resolveLovePerson({
      companionId:
        params?.companionId ?? activeCompanion?.id ?? companionId,
      name: params?.name,
      companions,
      activeCompanion,
      chatName: chat?.name,
    });
    if (person.companion?.id) {
      setActiveCompanionId(person.companion.id);
    }

    const nav =
      getHomeStackNavigation() ?? (navigation as NavigationProp<ParamListBase>);
    if (
      minimized &&
      (!params?.companionId || params.companionId === companionId)
    ) {
      restore();
      restoreLoveOverlays(nav, layer, person.companionId, person.name);
      return;
    }

    start({
      layer: params?.syncing ? "sync" : "chat",
      companionId: person.companionId,
      name: person.name,
      fromCreation: params?.fromCreation,
      syncing: params?.syncing,
      replace: Boolean(
        person.companionId && person.companionId !== companionId
      ),
    });
    const overlayParams = {
      companionId: person.companionId,
      name: person.name,
      fromCreation: params?.fromCreation,
      syncing: params?.syncing,
    };
    nav.navigate(SCREENS.LOVE_CHAT as never, overlayParams as never);
    if (params?.syncing) {
      nav.navigate(SCREENS.LOVE_SYNC as never, overlayParams as never);
    }
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
    companions.find((item) => item.id === companionId) ?? activeCompanion;
  const look = companion ? lookFromCompanion(companion) : null;

  return (
    <TouchableOpacity
      style={[styles.pill, style]}
      onPress={onPress ?? (() => openLove())}
      activeOpacity={0.85}
    >
      <LookFace look={look} size={s(37)} />
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
