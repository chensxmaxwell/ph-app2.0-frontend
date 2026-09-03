import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { BlurView } from "@react-native-community/blur";
import {
  NavigationProp,
  ParamListBase,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { useCompanions } from "../../store/companions";
import { useChat } from "../chat/store";
import { usePersonFace } from "../avatar/use-person-face";
import { CallBody } from "../call/call-body";
import { CALL_CONNECT_DELAY_MS, useVoiceCall } from "../call/use-voice-call";
import { dismissLoveOverlays } from "./overlay";
import { resolveLovePerson } from "./partner";
import { useLoveSession } from "./session";
import type { LoveBubble } from "./types";

type CallRoute = RouteProp<
  {
    LoveCall: { companionId?: string; name?: string };
  },
  "LoveCall"
>;

const nextId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

// Voice / video call inside a Love session. Minimize keeps the session (the
// global pill restores this overlay); hang-up ends the call layer and lands
// back on the chat underneath. Spoken turns are written to the Love
// transcript, which lives in LoveSessionProvider so minimize keeps them.
export const LoveCallScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<CallRoute>();
  const { companions, activeCompanion } = useCompanions();
  const { threads } = useChat();
  const {
    start,
    patchChat,
    minimize,
    companionId,
    chat,
    callStartedAt,
    ensureLayerTimer,
    clearLayerTimer,
  } = useLoveSession();
  const {
    companionId: partnerId,
    name,
    personality,
    story,
  } = resolveLovePerson({
    companionId: companionId ?? route.params?.companionId ?? chat?.companionId,
    name: route.params?.name,
    companions,
    threads,
    activeCompanion,
    chatName: chat?.name,
  });
  // The person being called, not the bundled stock call portrait (Kevin's).
  const { face } = usePersonFace(partnerId);
  const chatMessages = chat?.messages;
  const history = useMemo(
    () =>
      (chatMessages ?? [])
        .filter((item): item is LoveBubble => item.kind === "bubble")
        .map((item) => ({ from: item.from, text: item.text })),
    [chatMessages]
  );
  // Restored from the pill: the call has been running, no ring.
  const [connectDelayMs] = useState(() =>
    callStartedAt ? 0 : CALL_CONNECT_DELAY_MS
  );
  const call = useVoiceCall({
    name,
    personality,
    story,
    history,
    connectDelayMs,
    onExchange: (userText, reply) =>
      patchChat((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            kind: "bubble",
            id: nextId(),
            from: "me",
            text: userText,
            synced: current.synced || undefined,
          },
          {
            kind: "bubble",
            id: nextId(),
            from: "them",
            text: reply,
            synced: current.synced || undefined,
          },
        ],
      })),
  });
  const [video, setVideo] = useState(false);
  const [now, setNow] = useState(Date.now());
  const elapsed = callStartedAt
    ? Math.max(0, Math.floor((now - callStartedAt) / 1000))
    : 0;

  useEffect(() => {
    start({
      layer: "call",
      companionId: partnerId,
      name,
    });
    ensureLayerTimer("call");
  }, [ensureLayerTimer, name, partnerId, start]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#2B2358", "#2B2358"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["#5E5DBF", "rgba(50, 41, 105, 0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <BlurView
        style={StyleSheet.absoluteFillObject}
        blurType="dark"
        blurAmount={75}
        reducedTransparencyFallbackColor="#2B2358"
      />
      <LinearGradient
        colors={["rgba(108, 108, 108, 0.6)", "rgba(33, 33, 33, 0.6)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <CallBody
        name={name}
        face={face}
        call={call}
        elapsed={elapsed}
        video={video}
        onToggleVideo={() => setVideo((current) => !current)}
        onMinimize={() => {
          minimize();
          dismissLoveOverlays(navigation);
        }}
        onHangUp={() => {
          call.hangUp();
          patchChat({ inCall: false });
          clearLayerTimer("call");
          start({
            layer: "chat",
            companionId: partnerId,
            name,
          });
          navigation.goBack();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#2B2358",
  },
});
