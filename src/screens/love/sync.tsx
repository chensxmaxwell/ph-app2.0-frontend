import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { BlurView } from "@react-native-community/blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  NavigationProp,
  ParamListBase,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import Minimize from "@images/minimize.svg";
import Xmark from "@images/icons/xmark.svg";
import Speaker from "@images/speaker.svg";
import MicroPhoneUnmute from "@images/microphone-unmute.svg";
import MicroPhoneMute from "@images/microphone-mute.svg";
import { RING_DURATION_MS } from "../../services/ringtone";
import { voiceForPerson } from "../../services/voices";
import { useCompanions } from "../../store/companions";
import { useChat } from "../chat/store";
import { LookFace } from "../avatar/look-face";
import { s } from "../avatar/scale";
import { usePersonFace } from "../avatar/use-person-face";
import { CallCaptions } from "../call/captions";
import { syncStatusLabel } from "../call/status";
import { useVoiceCall } from "../call/use-voice-call";
import { LovePill } from "./pill";
import { dismissLoveOverlays } from "./overlay";
import { resolveLovePerson } from "./partner";
import { useLoveSession } from "./session";
import type { LoveBubble } from "./types";
import { usePatternPlayer } from "../../hooks/usePatternPlayer";
import { wavePattern } from "../../store/patterns";

type SyncRoute = RouteProp<
  {
    LoveSync: { companionId?: string; name?: string };
  },
  "LoveSync"
>;

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest
    .toString()
    .padStart(2, "0")}`;
};

// Sync inside a Love session: the companion talks while (one day) it drives
// the toy over Bluetooth. There is no product yet, so the talk is what Sync
// is: the same hands-free loop as a call — the companion greets, the mic
// opens on its own, Ark answers as this person, the reply is spoken in their
// voice, the mic opens again — beside the mock motor. Minimize keeps the
// session (the pill restores this overlay already listening); the red X
// ends the Sync layer. The Love chat grounds the replies; nothing said here
// is written into it (landmine 26).
export const LoveSyncScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const route = useRoute<SyncRoute>();
  const { companions, activeCompanion } = useCompanions();
  const { threads, setSynced } = useChat();
  const {
    start,
    patchChat,
    minimize,
    end,
    companionId,
    chat,
    surface,
    syncStartedAt,
    ensureLayerTimer,
    clearLayerTimer,
  } = useLoveSession();
  const {
    companion,
    thread,
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
  const { face } = usePersonFace(partnerId);
  const { stop: stopMotor } = usePatternPlayer(
    wavePattern(72),
    "sync",
    true
  );
  const chatMessages = chat?.messages;
  const history = useMemo(
    () =>
      (chatMessages ?? [])
        .filter((item): item is LoveBubble => item.kind === "bubble")
        .map((item) => ({ from: item.from, text: item.text })),
    [chatMessages]
  );
  // A fresh Sync rings out loud for a few seconds before the greeting.
  // Restored from the pill (or entered while the Control Sync's clock was
  // already running): Sync has been on, no ring and no second greeting.
  const [connectDelayMs] = useState(() =>
    syncStartedAt ? 0 : RING_DURATION_MS
  );
  const call = useVoiceCall({
    name,
    personality,
    story,
    history,
    voiceId: voiceForPerson({ id: partnerId, thread, companion }).id,
    connectDelayMs,
    ringtone: true,
  });
  const [now, setNow] = useState(Date.now());
  const elapsed = syncStartedAt
    ? Math.max(0, Math.floor((now - syncStartedAt) / 1000))
    : 0;

  useEffect(() => {
    start({
      layer: "sync",
      companionId: partnerId,
      name,
    });
    ensureLayerTimer("sync");
  }, [ensureLayerTimer, name, partnerId, start]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hangUp = () => {
    call.hangUp();
    patchChat({ synced: false });
    if (partnerId) {
      setSynced(partnerId, false);
    }
    clearLayerTimer("sync");
    stopMotor();
    switch (surface) {
      case "love":
      case "message":
        // The chat this Sync was started from is directly under the overlay.
        start({
          layer: "chat",
          companionId: partnerId,
          name,
        });
        navigation.goBack();
        return;
      case "control":
        // Control hub Sync has no chat under it. Red X ends the session so no
        // pill lingers, and uncovers the hub the person started from.
        end();
        dismissLoveOverlays(navigation);
        return;
      default: {
        const exhaustive: never = surface;
        return exhaustive;
      }
    }
  };

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
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(108, 108, 108, 0.6)", "rgba(33, 33, 33, 0.6)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <TouchableOpacity
        testID="love-sync-minimize"
        onPress={() => {
          minimize();
          dismissLoveOverlays(navigation);
        }}
        hitSlop={8}
        style={[styles.minimize, { top: insets.top + s(26) }]}
      >
        <Minimize width={s(35)} height={s(35)} />
      </TouchableOpacity>
      <View style={[styles.identity, { top: insets.top + s(26) }]}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
      </View>
      <View style={styles.stage}>
        <View style={styles.glow} />
        <LookFace look={face.look} size={s(100)} fallbackSource={face.source} />
        <Text style={styles.caption}>Syncing</Text>
        <CallCaptions
          name={name}
          status={syncStatusLabel({ phase: call.phase, name })}
          call={call}
          centered
        />
      </View>
      <View style={[styles.controls, { bottom: insets.bottom + s(26) }]}>
        <TouchableOpacity
          testID="love-sync-mic"
          accessibilityLabel={call.muted ? "Unmute" : "Mute"}
          style={[styles.round, call.muted ? styles.roundOn : styles.roundOff]}
          onPress={() => call.setMuted(!call.muted)}
        >
          {call.muted ? (
            <MicroPhoneMute width={s(35)} height={s(35)} />
          ) : (
            <MicroPhoneUnmute width={s(35)} height={s(35)} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          testID="love-sync-hangup"
          style={styles.hangup}
          onPress={hangUp}
        >
          <Xmark width={s(20)} height={s(20)} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="love-sync-speaker"
          accessibilityLabel={call.speakerOn ? "Speaker off" : "Speaker on"}
          style={[
            styles.round,
            call.speakerOn ? styles.roundOn : styles.roundOff,
          ]}
          onPress={() => call.setSpeakerOn(!call.speakerOn)}
        >
          <Speaker width={s(35)} height={s(35)} />
        </TouchableOpacity>
      </View>
      <LovePill
        onPress={() => {
          minimize();
          dismissLoveOverlays(navigation);
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
    marginTop: s(16),
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
  glow: {
    position: "absolute",
    width: s(220),
    height: s(220),
    borderRadius: s(110),
    backgroundColor: "rgba(204, 160, 221, 0.35)",
  },
  caption: {
    marginTop: s(16),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
  },
  controls: {
    position: "absolute",
    left: s(48),
    right: s(48),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  round: {
    width: s(73),
    height: s(73),
    borderRadius: s(36.5),
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
  },
  roundOn: {
    backgroundColor: colors.grayLightest,
  },
  roundOff: {
    backgroundColor: colors.grayLighter,
  },
  hangup: {
    width: s(73),
    height: s(73),
    borderRadius: s(36.5),
    backgroundColor: "rgba(249, 95, 110, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
