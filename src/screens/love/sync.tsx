import React, { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
import { useCompanions } from "../../store/companions";
import { s } from "../avatar/scale";
import { LovePill } from "./pill";
import { dismissLoveOverlays } from "./overlay";
import { useLoveSession } from "./session";

const FACE = require("../../../assets/images/love/call-face.png");

type SyncRoute = RouteProp<
  {
    LoveSync: { companionId?: string };
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

export const LoveSyncScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const route = useRoute<SyncRoute>();
  const { companions, activeCompanion } = useCompanions();
  const { start, patchChat, minimize, companionId } = useLoveSession();
  const companion =
    companions.find((item) => item.id === route.params?.companionId) ??
    activeCompanion;
  const name = companion?.name ?? "Kevin";
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);

  useEffect(() => {
    start({
      layer: "sync",
      companionId: companion?.id ?? companionId,
      name,
    });
  }, [companion?.id, companionId, name, start]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((current) => current + 1);
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
        <Image source={FACE} style={styles.face} />
        <Text style={styles.caption}>Syncing</Text>
      </View>
      <View style={[styles.controls, { bottom: insets.bottom + s(26) }]}>
        <TouchableOpacity
          style={[styles.round, muted ? styles.roundOn : styles.roundOff]}
          onPress={() => setMuted((current) => !current)}
        >
          {muted ? (
            <MicroPhoneMute width={s(35)} height={s(35)} />
          ) : (
            <MicroPhoneUnmute width={s(35)} height={s(35)} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.hangup}
          onPress={() => {
            patchChat({ synced: false });
            start({
              layer: "chat",
              companionId: companion?.id ?? companionId,
              name,
            });
            navigation.goBack();
          }}
        >
          <Xmark width={s(20)} height={s(20)} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.round, speakerOn ? styles.roundOn : styles.roundOff]}
          onPress={() => setSpeakerOn((current) => !current)}
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
  face: {
    width: s(100),
    height: s(100),
    borderRadius: s(50),
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
