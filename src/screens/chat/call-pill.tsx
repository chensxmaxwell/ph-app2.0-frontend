import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "../../common/constant";
import { LookFace } from "../avatar/look-face";
import { s } from "../avatar/scale";
import { usePersonFace } from "../avatar/use-person-face";
import { formatElapsed } from "../call/call-body";
import { getHomeStackNavigation } from "../love/overlay";
import { useChat } from "./store";

// The 头像小窗 of a minimized Message call (Maxwell, TestFlight 1.2 (18): the
// top-left minimize on the Chad call landed on the plain Chad thread with
// nothing to say a call was on). This person's face and the running call
// clock, floating on the right edge like Love's pill and a little below it,
// on the thread and on every other screen; a tap brings the call screen back
// — already on, so no ring and no second greeting. Hang-up is the only end.
export const MessageCallPill = () => {
  const navigation = useNavigation();
  const { inCallThreadId, inCallStartedAt, callMinimized, getThread } =
    useChat();
  const thread = inCallThreadId ? getThread(inCallThreadId) : undefined;
  const { face } = usePersonFace(inCallThreadId ?? undefined, thread?.kind);
  const [now, setNow] = useState(() => Date.now());
  const showing = Boolean(inCallThreadId && callMinimized);

  useEffect(() => {
    if (!showing) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [showing]);

  if (!showing || !inCallThreadId) {
    return null;
  }
  const elapsed = inCallStartedAt
    ? Math.max(0, Math.floor((now - inCallStartedAt) / 1000))
    : 0;
  const name = thread?.name ?? "";

  return (
    <TouchableOpacity
      testID="message-call-pill"
      accessibilityRole="button"
      accessibilityLabel={`Return to the call with ${name}`.trim()}
      activeOpacity={0.85}
      style={styles.pill}
      onPress={() => {
        const nav =
          getHomeStackNavigation() ??
          (navigation as NavigationProp<ParamListBase>);
        nav.navigate(SCREENS.CHAT_CALL, { threadId: inCallThreadId } as never);
      }}
    >
      <LookFace look={face.look} size={s(40)} fallbackSource={face.source} />
      <Text style={styles.clock}>{formatElapsed(elapsed)}</Text>
    </TouchableOpacity>
  );
};

export const GlobalMessageCallPill = () => (
  <View pointerEvents="box-none" collapsable={false} style={styles.host}>
    <MessageCallPill />
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
    right: s(12),
    top: s(196),
    width: s(64),
    paddingVertical: s(8),
    borderRadius: s(20),
    backgroundColor: colors.grayLightest,
    borderWidth: 2,
    borderColor: colors.accentLightPink,
    alignItems: "center",
    gap: s(4),
    zIndex: 20,
  },
  clock: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 12,
  },
});
