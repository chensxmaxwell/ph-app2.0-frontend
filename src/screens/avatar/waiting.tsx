import React, { useEffect, useRef } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import WaitGlow from "@images/avatar/wait-glow.svg";
import { threadIdForCompanion } from "../chat/person";
import { useAvatarWizard } from "./context";
import { s } from "./scale";
import { useSaveCompanion } from "./use-save-companion";

// Where the create wizard lands after saving: Home underneath, the new
// companion's own Message thread on top, so back returns to Home. It used to
// reset onto the dark Love overlay seeded with "Start chatting with …", which
// Maxwell read as an empty black page (TestFlight 1.2 (12)); that Love session
// is not started here anymore.
export const routesAfterCompanionSaved = (threadId: string) => [
  { name: String(SCREENS.NAV_BAR) },
  { name: String(SCREENS.CHAT_THREAD), params: { threadId } },
];

export const AvatarWaitingScreen = () => {
  const navigation = useNavigation();
  const { draft, restoreBaseline } = useAvatarWizard();
  const save = useSaveCompanion();
  const didSaveRef = useRef(false);
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    const removeBack = BackHandler.addEventListener(
      "hardwareBackPress",
      () => !allowLeaveRef.current
    );
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!allowLeaveRef.current) {
        event.preventDefault();
      }
    });
    return () => {
      removeBack.remove();
      unsubscribe();
    };
  }, [navigation]);

  useEffect(() => {
    if (didSaveRef.current) {
      return;
    }
    didSaveRef.current = true;
    const companion = save();
    restoreBaseline();
    const routes = routesAfterCompanionSaved(threadIdForCompanion(companion));

    const timer = setTimeout(() => {
      allowLeaveRef.current = true;
      navigation.getParent()?.dispatch(
        CommonActions.reset({
          index: routes.length - 1,
          routes: routes as never,
        })
      );
    }, 1800);

    return () => clearTimeout(timer);
    // Save once from the draft captured on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = draft.name.trim() || "Kevin";

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#2B2358", "#2B2358"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.glow} pointerEvents="none">
        <WaitGlow width={s(740)} height={s(388)} />
      </View>
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Saving {name}…</Text>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#2B2358",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    transform: [{ rotate: "-90deg" }],
    opacity: 0.7,
  },
  safe: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
    width: s(329),
  },
});
