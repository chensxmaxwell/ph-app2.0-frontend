import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { ConnectionPill } from "@common/components/connection-pill";
import PlayButton from "@images/arrowtriangle-right.svg";
import PauseButton from "@images/pause.svg";
import { s } from "../avatar/scale";
import { SimplePage } from "../shared/simple-page";
import { SessionLovePill } from "../love/pill";
import { useHomeScreen } from "../../hooks/HomeScreenContext";
import { wavePattern } from "../../store/patterns";

const HUES = [
  "#F95F6E",
  "#F5A623",
  "#F8E71C",
  "#7ED321",
  "#50E3C2",
  "#4A90E2",
  "#BD10E0",
  "#B8A9C9",
];

export const AutoScreen = () => {
  const navigation = useNavigation();
  const [hue, setHue] = useState(0);
  const [intensity, setIntensity] = useState(3);
  const [playing, setPlaying] = useState(false);
  const { setCurrentMode, setMotorInput } = useHomeScreen();

  const active = useMemo(() => HUES[hue], [hue]);
  const pattern = useMemo(
    () => wavePattern(20 + intensity * 16),
    [intensity]
  );

  useEffect(() => {
    if (!playing) {
      setCurrentMode("");
      setMotorInput([]);
      return undefined;
    }
    setCurrentMode("auto");
    let index = 0;
    const timer = setInterval(() => {
      const value = pattern[index % pattern.length];
      setMotorInput([1, value, value, value]);
      index += 1;
    }, 280 + hue * 40);
    return () => clearInterval(timer);
  }, [hue, pattern, playing, setCurrentMode, setMotorInput]);

  return (
    <SimplePage title="Auto" onBack={() => navigation.goBack()}>
      <View style={styles.center}>
        <ConnectionPill />
        <View style={[styles.wheel, { borderColor: active }]}>
          {HUES.map((color, index) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.swatch,
                {
                  backgroundColor: color,
                  transform: [
                    { rotate: `${index * (360 / HUES.length)}deg` },
                    { translateY: -s(90) },
                  ],
                  opacity: hue === index ? 1 : 0.45,
                },
              ]}
              onPress={() => setHue(index)}
            />
          ))}
          <View style={[styles.core, { backgroundColor: active }]} />
        </View>
        <Text style={styles.label}>Intensity {intensity}</Text>
        <View style={styles.intensity}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.dot,
                value <= intensity ? { backgroundColor: active } : undefined,
              ]}
              onPress={() => setIntensity(value)}
            />
          ))}
        </View>
        <TouchableOpacity
          style={styles.play}
          onPress={() => setPlaying((current) => !current)}
        >
          {playing ? (
            <PauseButton width={s(48)} height={s(48)} />
          ) : (
            <PlayButton width={s(48)} height={s(48)} />
          )}
        </TouchableOpacity>
      </View>
      <SessionLovePill style={styles.pill} />
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    paddingTop: s(24),
  },
  wheel: {
    width: s(220),
    height: s(220),
    borderRadius: s(110),
    borderWidth: 2,
    marginTop: s(48),
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    position: "absolute",
    width: s(28),
    height: s(28),
    borderRadius: s(14),
  },
  core: {
    width: s(72),
    height: s(72),
    borderRadius: s(36),
  },
  label: {
    marginTop: s(36),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  intensity: {
    flexDirection: "row",
    gap: s(12),
    marginTop: s(16),
  },
  dot: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    backgroundColor: colors.grayLightest,
  },
  play: {
    marginTop: s(36),
  },
  pill: {
    position: "absolute",
    top: s(8),
    alignSelf: "center",
  },
});
