import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import PlayButton from "@images/arrowtriangle-right.svg";
import PauseButton from "@images/pause.svg";
import NextPattern from "@images/icons/forward-frame.svg";
import PrevPattern from "@images/icons/backward-frame.svg";
import { ConnectionPill } from "@common/components/connection-pill";
import { s } from "../avatar/scale";
import { SimplePage } from "../shared/simple-page";
import { SessionLovePill } from "../love/pill";
import { usePatternPlayer } from "../../hooks/usePatternPlayer";
import { BUILTIN_PATTERNS, nextNamedPattern } from "../../store/patterns";

export const PerformancePlayScreen = () => {
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<{ params: { title?: string } }, "params">>();
  const title = route.params?.title ?? "Hardcore";
  const [pack, setPack] = useState(
    () =>
      BUILTIN_PATTERNS.find((item) => item.title === title) ??
      BUILTIN_PATTERNS[1]
  );
  const { playing, toggle } = usePatternPlayer(pack.pattern, "performance");

  return (
    <SimplePage title={title} onBack={() => navigation.goBack()}>
      <View style={styles.body}>
        <ConnectionPill />
        <View style={styles.wave}>
          {Array.from({ length: 18 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height: s(24 + ((index * 17) % 70)),
                  opacity: playing ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => setPack(nextNamedPattern(pack.title, "prev"))}
          >
            <PrevPattern />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggle}>
            {playing ? (
              <PauseButton width={s(48)} height={s(48)} />
            ) : (
              <PlayButton width={s(48)} height={s(48)} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPack(nextNamedPattern(pack.title, "next"))}
          >
            <NextPattern />
          </TouchableOpacity>
        </View>
        <Text style={styles.caption}>
          {playing ? "Playing" : "Paused"} {pack.title}
        </Text>
      </View>
      <SessionLovePill style={styles.pill} />
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: "center",
    paddingTop: s(24),
  },
  wave: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: s(120),
    marginTop: s(80),
  },
  bar: {
    width: 8,
    borderRadius: 4,
    backgroundColor: "rgba(204, 160, 221, 0.9)",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(28),
    marginTop: s(48),
  },
  caption: {
    marginTop: s(24),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  pill: {
    position: "absolute",
    top: s(8),
    alignSelf: "center",
  },
});
