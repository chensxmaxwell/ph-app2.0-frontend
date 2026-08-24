import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Slider } from "@miblanchard/react-native-slider";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import { AvatarDraft, lookFromDraft, useAvatarWizard } from "./context";
import {
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_COLORS,
} from "./engine/viewer-html";
import { FittedAvatarPreview } from "./engine/AvatarPreview";
import { HairStyleIcon, toHairStyle } from "./hair-style-icon";
import { s } from "./scale";
import { WizardShell, useLeaveGuard } from "./shared";

const CATEGORIES = ["Hair", "Face", "Skin", "Body", "Eyes", "Age"] as const;
type Category = (typeof CATEGORIES)[number];

type SliderKey = keyof Pick<
  AvatarDraft,
  | "upperArms"
  | "chest"
  | "forearms"
  | "backAndHips"
  | "faceWidth"
  | "jaw"
  | "chin"
  | "eyeSize"
  | "age"
>;

type SliderConfig = { key: SliderKey; label: string };

const previewViewMode = (category: Category): "full" | "bust" => {
  switch (category) {
    case "Body":
      return "full";
    case "Hair":
    case "Face":
    case "Skin":
    case "Eyes":
    case "Age":
      return "bust";
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
};

const slidersForCategory = (category: Category): SliderConfig[] => {
  switch (category) {
    case "Hair":
    case "Skin":
      return [];
    case "Face":
      return [
        { key: "faceWidth", label: "Face" },
        { key: "jaw", label: "Jaw" },
        { key: "chin", label: "Chin" },
        { key: "eyeSize", label: "Eyes" },
      ];
    case "Body":
      return [
        { key: "upperArms", label: "Upper arms" },
        { key: "chest", label: "Chest" },
        { key: "forearms", label: "Forearms" },
        { key: "backAndHips", label: "Back and hips" },
      ];
    case "Eyes":
      return [{ key: "eyeSize", label: "Size" }];
    case "Age":
      return [{ key: "age", label: "Age" }];
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
};

const SwatchRow = ({
  colors: swatches,
  selected,
  onSelect,
}: {
  colors: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
}) => (
  <View style={styles.swatchRow}>
    {swatches.map((color, index) => {
      const isSelected = selected === index;
      return (
        <TouchableOpacity
          key={color}
          onPress={() => onSelect(index)}
          style={[
            styles.swatch,
            { backgroundColor: color },
            isSelected && styles.swatchSelected,
          ]}
        />
      );
    })}
  </View>
);

const SliderRow = ({
  slider,
  value,
  onChange,
}: {
  slider: SliderConfig;
  value: number;
  onChange: (value: number) => void;
}) => (
  <View style={styles.sliderRow}>
    <Text style={styles.sliderLabel}>{slider.label}</Text>
    <View style={styles.sliderTrack}>
      <Slider
        value={value}
        onValueChange={(next) => {
          const resolved = Array.isArray(next) ? next[0] : next;
          onChange(resolved);
        }}
        minimumValue={0}
        maximumValue={1}
        minimumTrackTintColor={colors.grayLightest}
        maximumTrackTintColor={colors.grayLightest}
        thumbTintColor={colors.white}
        containerStyle={styles.sliderContainer}
        trackStyle={styles.track}
        thumbStyle={styles.thumb}
      />
    </View>
  </View>
);

export const AvatarCustomizeScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft, resetDraft, isDirty } = useAvatarWizard();
  const [category, setCategory] = useState<Category>("Hair");
  const { requestLeave, modal } = useLeaveGuard(isDirty, () => {
    resetDraft();
    navigation.getParent()?.goBack();
  });
  const title = draft.name.trim() || "[Name]";
  const sliders = slidersForCategory(category);
  const hairColor = HAIR_COLORS[draft.hairColor] ?? HAIR_COLORS[1];

  const renderPanel = () => {
    switch (category) {
      case "Hair":
        return (
          <View style={styles.choicePanel}>
            <Text style={styles.sectionLabel}>Style</Text>
            <View style={styles.styleRow}>
              {([0, 1, 2, 3] as const).map((style) => {
                const selected = toHairStyle(draft.hairStyle) === style;
                return (
                  <TouchableOpacity
                    key={style}
                    onPress={() => patchDraft({ hairStyle: style })}
                    style={[styles.styleChip, selected && styles.styleChipSelected]}
                  >
                    <HairStyleIcon style={style} color={hairColor} size={s(28)} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.sectionLabel}>Color</Text>
            <SwatchRow
              colors={HAIR_COLORS}
              selected={draft.hairColor}
              onSelect={(hairColorIndex) =>
                patchDraft({ hairColor: hairColorIndex })
              }
            />
          </View>
        );
      case "Skin":
        return (
          <View style={styles.choicePanel}>
            <Text style={styles.sectionLabel}>Tone</Text>
            <SwatchRow
              colors={SKIN_COLORS}
              selected={draft.skinTone}
              onSelect={(skinTone) => patchDraft({ skinTone })}
            />
          </View>
        );
      case "Eyes":
        return (
          <View style={styles.choicePanel}>
            <Text style={styles.sectionLabel}>Color</Text>
            <SwatchRow
              colors={EYE_COLORS}
              selected={draft.eyeColor}
              onSelect={(eyeColor) => patchDraft({ eyeColor })}
            />
            {sliders.map((slider) => (
              <SliderRow
                key={slider.key}
                slider={slider}
                value={draft[slider.key]}
                onChange={(value) => patchDraft({ [slider.key]: value })}
              />
            ))}
          </View>
        );
      case "Face":
      case "Body":
      case "Age":
        return (
          <View style={styles.sliderPanel}>
            {sliders.map((slider) => (
              <SliderRow
                key={`${category}-${slider.key}`}
                slider={slider}
                value={draft[slider.key]}
                onChange={(value) => patchDraft({ [slider.key]: value })}
              />
            ))}
          </View>
        );
      default: {
        const exhaustive: never = category;
        return exhaustive;
      }
    }
  };

  return (
    <WizardShell
      title={title}
      titleFont="opensans"
      leftIcon="back"
      rightIcon="close"
      closeCircle
      onLeftPress={() => navigation.goBack()}
      onRightPress={requestLeave}
      primaryLabel="Finish customization"
      onPrimary={() => navigation.navigate(SCREENS.AVATAR_PERSONALITY)}
    >
      {modal}
      <View style={styles.content}>
        <FittedAvatarPreview
          look={lookFromDraft(draft)}
          viewMode={previewViewMode(category)}
        />
        <View style={styles.panel}>{renderPanel()}</View>
        <View style={styles.categoryBar}>
          {CATEGORIES.map((item) => {
            const selected = item === category;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.categoryPill,
                  selected && styles.categoryPillSelected,
                ]}
              >
                <Text style={styles.categoryText}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    minHeight: 0,
  },
  panel: {
    marginTop: s(4),
    width: s(367),
    height: s(200),
    borderRadius: s(22),
    backgroundColor: colors.grayLightest,
    paddingTop: s(12),
    paddingHorizontal: s(14),
    paddingBottom: s(12),
    flexShrink: 0,
  },
  sliderPanel: {
    flex: 1,
    justifyContent: "space-evenly",
  },
  choicePanel: {
    flex: 1,
    justifyContent: "flex-start",
    gap: s(8),
  },
  sectionLabel: {
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontSize: 13,
    lineHeight: 16,
  },
  styleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  styleChip: {
    width: s(74),
    height: s(52),
    borderRadius: s(12),
    backgroundColor: "rgba(43, 35, 88, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  styleChipSelected: {
    backgroundColor: "rgba(243, 243, 243, 0.45)",
    borderWidth: 1,
    borderColor: colors.white,
  },
  swatchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  swatch: {
    width: s(32),
    height: s(32),
    borderRadius: s(16),
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: colors.white,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: s(28),
  },
  sliderLabel: {
    width: s(120),
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontSize: 15,
  },
  sliderTrack: {
    width: s(191),
    height: s(28),
    justifyContent: "center",
  },
  sliderContainer: {
    height: s(28),
    justifyContent: "center",
  },
  track: {
    height: s(10),
    borderRadius: s(20),
    backgroundColor: colors.grayLightest,
  },
  thumb: {
    width: s(14),
    height: s(14),
    borderRadius: s(7),
    backgroundColor: colors.white,
  },
  categoryBar: {
    marginTop: s(5),
    marginBottom: s(4),
    width: s(367),
    height: s(40),
    borderRadius: s(18),
    backgroundColor: colors.grayLightest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: s(2),
    flexShrink: 0,
    zIndex: 2,
  },
  categoryPill: {
    height: s(31),
    flex: 1,
    borderRadius: s(12),
    alignItems: "center",
    justifyContent: "center",
  },
  categoryPillSelected: {
    backgroundColor: "rgba(243, 243, 243, 0.45)",
  },
  categoryText: {
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontSize: 13,
  },
});
