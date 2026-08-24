import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import WaitGlow from "@images/avatar/wait-glow.svg";
import { useCompanions } from "../../store/companions";
import { useLoveSession } from "../love/session";
import { lookFromDraft, useAvatarWizard } from "./context";
import { s } from "./scale";

export const AvatarWaitingScreen = () => {
  const navigation = useNavigation();
  const { draft, resetDraft } = useAvatarWizard();
  const { addCompanion } = useCompanions();
  const { start } = useLoveSession();
  const didSaveRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (didSaveRef.current) {
        return;
      }
      didSaveRef.current = true;
      const companionId = `${Date.now()}`;
      const companion = {
        id: companionId,
        name: draft.name.trim() || "Kevin",
        birthday: draft.birthday,
        gender: draft.gender,
        personalities: draft.personalities,
        story: draft.story,
        passionateTender: draft.passionateTender,
        dominantSubmissive: draft.dominantSubmissive,
        experimentalVanilla: draft.experimentalVanilla,
        ...lookFromDraft(draft),
      };
      addCompanion(companion);
      start({
        layer: "chat",
        companionId,
        name: companion.name,
        fromCreation: true,
        replace: true,
      });
      resetDraft();
      navigation
        .getParent()
        ?.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: SCREENS.NAV_BAR },
              {
                name: SCREENS.LOVE_CHAT,
                params: { companionId, fromCreation: true },
              },
            ],
          })
        );
    }, 1800);

    return () => clearTimeout(timer);
    // Save once from the draft captured on first mount; didSaveRef blocks a second add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <Text style={styles.title}>Please wait...</Text>
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
