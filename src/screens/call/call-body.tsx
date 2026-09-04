import React, { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import Minimize from "@images/minimize.svg";
import PhoneDown from "@images/love/phone-down.svg";
import MicroPhoneUnmute from "@images/microphone-unmute.svg";
import PhoneUp from "@images/message/phone.svg";
import type { CompanionFace } from "../avatar/face";
import { LookFace } from "../avatar/look-face";
import { s } from "../avatar/scale";
import { CameraIcon } from "./camera-icon";
import { callStatusLabel, holdButtonLabel, modeToggle } from "./status";
import type { VoiceCall } from "./use-voice-call";
import { VideoStage } from "./video-stage";

export const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest
    .toString()
    .padStart(2, "0")}`;
};

type CallBodyProps = {
  name: string;
  face: CompanionFace;
  call: VoiceCall;
  elapsed: number;
  video: boolean;
  onToggleVideo: () => void;
  onHangUp: () => void;
  onMinimize: () => void;
};

const Captions = ({
  name,
  call,
  centered,
}: {
  name: string;
  call: VoiceCall;
  centered: boolean;
}) => (
  <View style={[styles.captions, centered && styles.captionsCentered]}>
    <Text testID="call-status" style={styles.status}>
      {callStatusLabel({ phase: call.phase, name })}
    </Text>
    {call.heard ? (
      <View style={styles.captionBlock}>
        <Text style={styles.captionWho}>You</Text>
        <Text testID="call-heard" style={styles.captionText} numberOfLines={3}>
          {call.heard}
        </Text>
      </View>
    ) : null}
    {call.reply ? (
      <View style={styles.captionBlock}>
        <Text style={styles.captionWho}>{name}</Text>
        <Text testID="call-reply" style={styles.captionText} numberOfLines={4}>
          {call.reply}
        </Text>
      </View>
    ) : null}
    {call.notice ? (
      <View style={styles.notice}>
        <Text testID="call-notice" style={styles.noticeText}>
          {call.notice}
        </Text>
      </View>
    ) : null}
  </View>
);

const SpeakingRing = ({
  speaking,
  children,
}: {
  speaking: boolean;
  children: ReactNode;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!speaking) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
    };
  }, [scale, speaking]);

  return (
    <Animated.View
      style={[
        styles.ring,
        speaking && styles.ringSpeaking,
        { transform: [{ scale }] },
      ]}
    >
      {children}
    </Animated.View>
  );
};

// Everything on a call except the backdrop and the session it belongs to:
// the Message call and the Love call render this over their own gradients.
export const CallBody = ({
  name,
  face,
  call,
  elapsed,
  video,
  onToggleVideo,
  onHangUp,
  onMinimize,
}: CallBodyProps) => {
  const insets = useSafeAreaInsets();
  const speaking = call.phase === "speaking";
  const holding = call.phase === "listening";
  const toggle = modeToggle(video);

  return (
    <View style={styles.root}>
      <TouchableOpacity
        testID="call-minimize"
        onPress={onMinimize}
        hitSlop={8}
        style={[styles.minimize, { top: insets.top + s(26) }]}
      >
        <Minimize width={s(35)} height={s(35)} />
      </TouchableOpacity>
      <View style={[styles.identity, { top: insets.top + s(26) }]}>
        <Text style={styles.name}>{name}</Text>
        {call.connected ? (
          <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
        ) : null}
      </View>

      <View
        style={[
          styles.body,
          {
            paddingTop: insets.top + s(26) + s(96),
            paddingBottom: insets.bottom + s(26) + s(140),
          },
        ]}
      >
        {video ? (
          <VideoStage face={face} speaking={speaking}>
            <Captions name={name} call={call} centered={false} />
          </VideoStage>
        ) : (
          <View style={styles.stage}>
            <View testID="call-stage-face">
              <SpeakingRing speaking={speaking}>
                <LookFace
                  look={face.look}
                  size={s(100)}
                  fallbackSource={face.source}
                />
              </SpeakingRing>
            </View>
            <Captions name={name} call={call} centered />
          </View>
        )}
      </View>

      <View style={[styles.controls, { bottom: insets.bottom + s(26) }]}>
        <View style={styles.control}>
          <Pressable
            testID="call-hold"
            onPressIn={call.holdStart}
            onPressOut={call.holdEnd}
            disabled={!call.connected}
            style={[
              styles.round,
              holding && styles.roundHot,
              !call.connected && styles.roundDisabled,
            ]}
          >
            <MicroPhoneUnmute width={s(35)} height={s(35)} />
          </Pressable>
          <Text style={styles.controlLabel}>{holdButtonLabel(call.phase)}</Text>
        </View>
        <View style={styles.control}>
          <TouchableOpacity
            testID="call-hangup"
            onPress={onHangUp}
            style={styles.hangup}
            activeOpacity={0.85}
          >
            <PhoneDown width={s(45.38)} height={s(16.88)} />
          </TouchableOpacity>
        </View>
        <View style={styles.control}>
          <TouchableOpacity
            testID="call-video-toggle"
            onPress={onToggleVideo}
            style={[styles.round, video && styles.roundOn]}
            activeOpacity={0.85}
          >
            <View testID={`call-mode-icon-${toggle.target}`}>
              {toggle.target === "video" ? (
                <CameraIcon size={s(35)} />
              ) : (
                <PhoneUp width={s(35)} height={s(35)} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.controlLabel}>{toggle.label}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
    textAlign: "center",
  },
  body: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: s(24),
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
  ringSpeaking: {
    borderWidth: 3,
    backgroundColor: "rgba(204, 160, 221, 0.25)",
  },
  captions: {
    marginTop: s(16),
    gap: s(10),
    paddingHorizontal: s(24),
    width: "100%",
  },
  captionsCentered: {
    alignItems: "center",
  },
  status: {
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontSize: 20,
  },
  captionBlock: {
    gap: s(2),
  },
  captionWho: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 11,
  },
  captionText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 14,
    lineHeight: 19,
  },
  notice: {
    maxWidth: s(300),
    paddingHorizontal: s(16),
    paddingVertical: s(12),
    borderRadius: s(16),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  noticeText: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  controls: {
    position: "absolute",
    left: s(24),
    right: s(24),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  control: {
    width: s(100),
    alignItems: "center",
    gap: s(8),
  },
  controlLabel: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 12,
    textAlign: "center",
  },
  round: {
    width: s(73),
    height: s(73),
    borderRadius: s(36.5),
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
    marginTop: s(13.5),
  },
  roundHot: {
    backgroundColor: colors.accentLightPink,
  },
  roundOn: {
    borderWidth: 2,
    borderColor: colors.white,
  },
  roundDisabled: {
    opacity: 0.5,
  },
  hangup: {
    width: s(100),
    height: s(100),
    borderRadius: s(50),
    backgroundColor: "rgba(249, 95, 110, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
});
