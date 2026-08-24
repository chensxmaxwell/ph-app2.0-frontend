import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import PlayIcon from "@images/Kink/play.svg";
import PauseButton from "@images/pause.svg";
import ForwardIcon from "@images/Kink/forward.svg";
import BackwardIcon from "@images/Kink/backward.svg";
import ChevronLeftfrom from "@images/chevron-left-white.svg";
import { useAppContext } from "./kink-context";
import { usePatternPlayer } from "../../hooks/usePatternPlayer";
import { BUILTIN_PATTERNS, nextNamedPattern } from "../../store/patterns";
import { ConnectionPill } from "@common/components/connection-pill";

const KinkPlayerScreen = () => {
  const navigation = useNavigation();
  const { kinkName, intensity, emotion } = useAppContext();
  const title = kinkName || emotion || "Kink";
  const seed = useMemo(() => {
    const peak = 35 + Number(intensity || 0) * 12;
    return BUILTIN_PATTERNS[1].pattern.map((value) =>
      Math.max(8, Math.min(100, Math.round((value * peak) / 100)))
    );
  }, [intensity]);
  const [pack, setPack] = useState({
    title: "Pulse",
    pattern: seed,
  });
  const { playing, toggle } = usePatternPlayer(pack.pattern, "kink", true);

  return (
    <SafeAreaView style={styles.container}>
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

      <View>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeftfrom width={35} height={35} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.subtitle}>{playing ? "Playing" : "Ready"}</Text>
        <ConnectionPill />
      </View>

      <View style={styles.progressContainer}>
        <View
          style={[styles.progress, { width: playing ? "70%" : "8%" }]}
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setPack(nextNamedPattern(pack.title, "prev"))}
        >
          <BackwardIcon width={60} height={60} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playButton} onPress={toggle}>
          {playing ? (
            <PauseButton width={48} height={48} />
          ) : (
            <PlayIcon width={60} height={60} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setPack(nextNamedPattern(pack.title, "next"))}
        >
          <ForwardIcon width={60} height={60} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  headerSpacer: {
    width: 35,
    height: 35,
  },
  subtitle: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    height: 25,
    marginVertical: 10,
  },
  progressContainer: {
    height: 5,
    width: "100%",
    backgroundColor: colors.grayLightest,
    borderRadius: 2,
  },
  progress: {
    height: 5,
    backgroundColor: "#cca0dd",
    borderRadius: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 60,
    marginBottom: 24,
  },
  controlButton: {
    padding: 10,
  },
  playButton: {
    padding: 10,
    backgroundColor: colors.grayLightest,
    borderRadius: 50,
  },
});

export default KinkPlayerScreen;
