import React, { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import Minimize from "@images/minimize.svg";
import PhoneDown from "@images/love/phone-down.svg";
import { s } from "../avatar/scale";
import { ChatGradient } from "./background";
import { useChat } from "./store";
import { faceSourceForId } from "./faces";

type CallRoute = RouteProp<{ ChatCall: { threadId: string } }, "ChatCall">;

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest
    .toString()
    .padStart(2, "0")}`;
};

export const ChatCallScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute<CallRoute>();
  const { getThread, setInCall, setListen, stopSpeaking } = useChat();
  const thread = getThread(route.params.threadId);
  const name = thread?.name ?? "Kevin";
  const [connected, setConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const endedRef = useRef(false);

  useEffect(() => {
    setInCall(route.params.threadId);
    if (thread?.listen) {
      setListen(thread.id, false);
      stopSpeaking();
    }
    const connect = setTimeout(() => setConnected(true), 1600);
    return () => {
      clearTimeout(connect);
      if (endedRef.current) {
        setInCall(null);
      }
    };
  }, [route.params.threadId]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    const timer = setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [connected]);

  return (
    <ChatGradient>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={8}
        style={[styles.minimize, { top: insets.top + s(26) }]}
      >
        <Minimize width={s(35)} height={s(35)} />
      </TouchableOpacity>
      <View style={[styles.identity, { top: insets.top + s(26) }]}>
        <Text style={styles.name}>{name}</Text>
        {connected ? (
          <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
        ) : null}
      </View>
      <View style={styles.stage}>
        <View style={styles.ring}>
          <Image
            source={faceSourceForId(thread?.id, thread?.kind)}
            style={styles.face}
          />
        </View>
        <Text style={styles.status}>
          {connected ? "Connected" : `Calling ${name}`}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          endedRef.current = true;
          setInCall(null);
          navigation.goBack();
        }}
        style={[styles.hangup, { bottom: insets.bottom + s(26) }]}
        activeOpacity={0.85}
      >
        <PhoneDown width={s(45.38)} height={s(16.88)} />
      </TouchableOpacity>
    </ChatGradient>
  );
};

const styles = StyleSheet.create({
  minimize: {
    position: "absolute",
    left: s(20),
    width: s(35),
    height: s(35),
    zIndex: 2,
  },
  identity: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  name: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 24,
    textAlign: "center",
  },
  timer: {
    marginTop: s(24),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 24,
  },
  stage: {
    position: "absolute",
    top: s(241),
    left: 0,
    right: 0,
    alignItems: "center",
  },
  ring: {
    width: s(112),
    height: s(112),
    borderRadius: s(56),
    borderWidth: 2,
    borderColor: "#cbb7e8",
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    width: s(100),
    height: s(100),
    borderRadius: s(50),
  },
  status: {
    marginTop: s(16),
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  hangup: {
    position: "absolute",
    alignSelf: "center",
    left: s(144),
    width: s(100),
    height: s(100),
    borderRadius: s(50),
    backgroundColor: "rgba(249, 95, 110, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
});
