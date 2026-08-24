import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
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
import PhoneDown from "@images/love/phone-down.svg";
import { useCompanions } from "../../store/companions";
import { s } from "../avatar/scale";
import { dismissLoveOverlays } from "./overlay";
import { useLoveSession } from "./session";

const CALL_FACE = require("../../../assets/images/love/call-face.png");

type CallRoute = RouteProp<
  {
    LoveCall: { companionId?: string };
  },
  "LoveCall"
>;

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest
    .toString()
    .padStart(2, "0")}`;
};

export const LoveCallScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const route = useRoute<CallRoute>();
  const { companions, activeCompanion } = useCompanions();
  const { start, patchChat, minimize, companionId } = useLoveSession();
  const companion =
    companions.find((item) => item.id === route.params?.companionId) ??
    activeCompanion;
  const name = companion?.name ?? "Kevin";
  const [elapsed, setElapsed] = useState(0);
  const [pressing, setPressing] = useState(false);

  useEffect(() => {
    start({
      layer: "call",
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
      />
      <LinearGradient
        colors={["rgba(108, 108, 108, 0.6)", "rgba(33, 33, 33, 0.6)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
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
        <Pressable
          onPressIn={() => setPressing(true)}
          onPressOut={() => setPressing(false)}
          style={[styles.faceWrap, pressing && styles.facePressed]}
        >
          <Image source={CALL_FACE} style={styles.face} />
        </Pressable>
        <Text style={styles.press}>Press</Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          patchChat({ inCall: false });
          start({
            layer: "chat",
            companionId: companion?.id ?? companionId,
            name,
          });
          navigation.goBack();
        }}
        style={[styles.hangup, { bottom: insets.bottom + s(26) }]}
        activeOpacity={0.85}
      >
        <View style={styles.hangupIcon}>
          <PhoneDown width={s(45.38)} height={s(16.88)} />
        </View>
      </TouchableOpacity>
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
    width: s(151),
    height: s(30),
  },
  timer: {
    marginTop: s(24),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 24,
    textAlign: "center",
    width: s(151),
    height: s(30),
  },
  stage: {
    position: "absolute",
    top: s(241),
    left: 0,
    right: 0,
    alignItems: "center",
  },
  faceWrap: {
    width: s(100),
    height: s(100),
  },
  facePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  face: {
    width: s(100),
    height: s(100),
    borderRadius: s(50),
  },
  press: {
    marginTop: s(10),
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontSize: 20,
    textAlign: "center",
    width: s(202),
    height: s(54),
    lineHeight: s(54),
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
  hangupIcon: {
    width: s(60),
    height: s(60),
    alignItems: "center",
    justifyContent: "center",
  },
});
