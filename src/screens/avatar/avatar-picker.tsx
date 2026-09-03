import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "@common/styles/colors";
import type { AvatarChoice } from "../chat/types";
import type { AvatarOption } from "./face";
import { LookFace } from "./look-face";
import { s } from "./scale";

const RING = 3;

// Grid of the faces a person can wear: the crafted 3D look, a seeded photo,
// the bundled portraits. The selected one is ringed; `selected` is null while
// the create wizard still waits for a pick.
export const AvatarPicker = ({
  options,
  selected,
  onSelect,
  size = s(64),
}: {
  options: AvatarOption[];
  selected: AvatarChoice | null;
  onSelect: (choice: AvatarChoice) => void;
  size?: number;
}) => (
  <View style={styles.grid} testID="avatar-picker">
    {options.map((option) => {
      const active = option.kind === selected;
      return (
        <TouchableOpacity
          key={option.kind}
          testID={`avatar-option-${option.kind}`}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: active }}
          style={styles.option}
          onPress={() => onSelect(option.kind)}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.ring,
              {
                width: size + RING * 2,
                height: size + RING * 2,
                borderRadius: (size + RING * 2) / 2,
              },
              active ? styles.ringOn : null,
            ]}
          >
            <LookFace
              look={option.face.look}
              size={size}
              fallbackSource={option.face.source}
            />
          </View>
          <Text
            style={[styles.label, active ? styles.labelOn : null]}
            numberOfLines={1}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: s(14),
    rowGap: s(12),
  },
  option: {
    alignItems: "center",
    gap: s(6),
    width: s(72),
  },
  ring: {
    borderWidth: RING,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  ringOn: {
    borderColor: "#cbb7e8",
  },
  label: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 12,
  },
  labelOn: {
    color: colors.white,
  },
});
