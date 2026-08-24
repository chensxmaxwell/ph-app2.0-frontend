import React from "react";
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import { useCompanions } from "../../store/companions";
import { s } from "../avatar/scale";
import { restoreLoveOverlays } from "./overlay";
import { useLoveSession } from "./session";

const FACE = require("../../../assets/images/love/face.png");

export type LoveChatParams = {
  companionId?: string;
  fromCreation?: boolean;
  syncing?: boolean;
};

export const useOpenLove = () => {
  const navigation = useNavigation();
  const { activeCompanion, companions, setActiveCompanionId } = useCompanions();
  const { start, restore, minimized, companionId, layer } = useLoveSession();

  return (params?: LoveChatParams) => {
    const nextId = params?.companionId ?? activeCompanion?.id ?? companionId;
    const companion = companions.find((item) => item.id === nextId);
    if (nextId) {
      setActiveCompanionId(nextId);
    }

    const nav = navigation as NavigationProp<ParamListBase>;
    if (minimized && (!params?.companionId || params.companionId === companionId)) {
      restore();
      restoreLoveOverlays(nav, layer, nextId);
      return;
    }

    start({
      layer: params?.syncing ? "sync" : "chat",
      companionId: nextId,
      name: companion?.name,
      fromCreation: params?.fromCreation,
      syncing: params?.syncing,
      replace: Boolean(nextId && nextId !== companionId),
    });
    nav.navigate(SCREENS.LOVE_CHAT as never, {
      companionId: nextId,
      fromCreation: params?.fromCreation,
      syncing: params?.syncing,
    } as never);
    if (params?.syncing) {
      nav.navigate(SCREENS.LOVE_SYNC as never, { companionId: nextId } as never);
    }
  };
};

type LovePillProps = {
  onPress?: () => void;
  style?: ViewStyle;
};

export const LovePill = ({ onPress, style }: LovePillProps) => {
  const openLove = useOpenLove();

  return (
    <TouchableOpacity
      style={[styles.pill, style]}
      onPress={onPress ?? (() => openLove())}
      activeOpacity={0.85}
    >
      <Image source={FACE} style={styles.face} />
    </TouchableOpacity>
  );
};

export const SessionLovePill = ({ style }: { style?: ViewStyle }) => {
  const navigation = useNavigation();
  const { minimized, layer, companionId, restore } = useLoveSession();

  if (!minimized) {
    return null;
  }

  return (
    <LovePill
      style={style}
      onPress={() => {
        restore();
        restoreLoveOverlays(
          navigation as NavigationProp<ParamListBase>,
          layer,
          companionId
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
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
