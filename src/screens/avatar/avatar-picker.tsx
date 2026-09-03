import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "@common/styles/colors";
import type { AvatarChoice } from "../chat/types";
import type { AvatarOption } from "./face";
import { LookFace } from "./look-face";
import { s } from "./scale";

const RING = 3;

// Row of the faces a person can wear (crafted 3D look, bundled photo). The
// selected one is ringed. Callers only render this when there is a choice.
export const AvatarPicker = ({
  options,
  selected,
  onSelect,
  size = s(72),
}: {
  options: AvatarOption[];
  selected: AvatarChoice;
  onSelect: (choice: AvatarChoice) => void;
  size?: number;
}) => (
  <View style={styles.row} testID="avatar-picker">
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
          <Text style={[styles.label, active ? styles.labelOn : null]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: s(24),
  },
  option: {
    alignItems: "center",
    gap: s(8),
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
    fontSize: 13,
  },
  labelOn: {
    color: colors.white,
  },
});
