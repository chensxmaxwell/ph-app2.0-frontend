import React, { useEffect, useRef } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import WaitGlow from "@images/avatar/wait-glow.svg";
import { useLoveSession } from "../love/session";
import { useAvatarWizard } from "./context";
import { s } from "./scale";
import { useSaveCompanion } from "./use-save-companion";

export const AvatarWaitingScreen = () => {
  const navigation = useNavigation();
  const { draft, companionId, restoreBaseline } = useAvatarWizard();
  const save = useSaveCompanion();
  const { start } = useLoveSession();
  const didSaveRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const savedIdRef = useRef(companionId);

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
    savedIdRef.current = companion.id;
    start({
      layer: "chat",
      companionId: companion.id,
      name: companion.name,
      fromCreation: true,
      replace: true,
    });
    restoreBaseline();

    const timer = setTimeout(() => {
      allowLeaveRef.current = true;
      navigation.getParent()?.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: SCREENS.NAV_BAR },
            {
              name: SCREENS.LOVE_CHAT,
              params: { companionId: companion.id, fromCreation: true },
            },
          ],
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
