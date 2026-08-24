import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { colors } from "@common/styles/colors";
import { s } from "./scale";

export type OutfitIndex = 0 | 1 | 2 | 3;

const OUTFIT_INDICES: OutfitIndex[] = [0, 1, 2, 3];

export const toOutfitIndex = (index: number): OutfitIndex =>
  OUTFIT_INDICES[((index % 4) + 4) % 4] ?? 0;

const SKIN = "#e8c4a8";
const HAIR = "#2b2118";
const LINE = "rgba(20, 16, 40, 0.28)";

const CAPTIONS: Record<OutfitIndex, string> = {
  0: "Tee · jeans",
  1: "Jacket · cargo",
  2: "Hoodie",
  3: "Tank · dress",
};

const Head = () => (
  <>
    <Circle cx="40" cy="15" r="8" fill={SKIN} />
    <Path
      d="M32.5 14.5 C33 7.5 47 7.5 47.5 14.5 C45 11 35 11 32.5 14.5 Z"
      fill={HAIR}
    />
    <Rect x="37" y="22" width="6" height="5" rx="1.5" fill={SKIN} />
  </>
);

const OutfitFigure = ({ outfit }: { outfit: OutfitIndex }) => {
  switch (outfit) {
    case 0:
      return (
        <Svg width="100%" height="100%" viewBox="0 0 80 86">
          <Head />
          <Rect x="22" y="26" width="9" height="13" rx="4" fill="#f0eeea" />
          <Rect x="49" y="26" width="9" height="13" rx="4" fill="#f0eeea" />
          <Path
            d="M27 26 H53 C56 26 57 28 57 31 V46 C57 48 55 49 53 49 H27 C25 49 23 48 23 46 V31 C23 28 24 26 27 26 Z"
            fill="#f3f1ed"
            stroke={LINE}
            strokeWidth="0.8"
          />
          <Circle cx="40" cy="32" r="1.4" fill={LINE} />
          <Path
            d="M27 48 H53 C55 48 56 50 56 52 V72 C56 74 54 75 52 75 H28 C26 75 24 74 24 72 V52 C24 50 25 48 27 48 Z"
            fill="#3d6cb0"
          />
          <Rect x="39" y="48" width="2" height="27" fill="#2f5a96" />
          <Rect x="24" y="73" width="14" height="8" rx="2.5" fill="#f5f5f5" />
          <Rect x="42" y="73" width="14" height="8" rx="2.5" fill="#f5f5f5" />
          <Rect x="24" y="79" width="14" height="2.5" rx="1" fill="#2a2a2a" />
          <Rect x="42" y="79" width="14" height="2.5" rx="1" fill="#2a2a2a" />
        </Svg>
      );
    case 1:
      return (
        <Svg width="100%" height="100%" viewBox="0 0 80 86">
          <Head />
          <Path
            d="M24 25 H56 C59 25 61 28 61 32 V50 C61 52 59 53 57 53 H23 C21 53 19 52 19 50 V32 C19 28 21 25 24 25 Z"
            fill="#6b7c4f"
            stroke={LINE}
            strokeWidth="0.8"
          />
          <Path d="M32 25 L40 36 L48 25 Z" fill="#55633e" />
          <Rect x="18" y="28" width="10" height="22" rx="4" fill="#5e6e45" />
          <Rect x="52" y="28" width="10" height="22" rx="4" fill="#5e6e45" />
          <Path
            d="M26 51 H54 C56 51 57 53 57 55 V71 C57 73 55 74 53 74 H27 C25 74 23 73 23 71 V55 C23 53 24 51 26 51 Z"
            fill="#c4a35a"
          />
          <Rect x="28" y="58" width="7" height="8" rx="1.5" fill="#a88848" />
          <Rect x="45" y="58" width="7" height="8" rx="1.5" fill="#a88848" />
          <Rect x="24" y="71" width="14" height="11" rx="2" fill="#5c3310" />
          <Rect x="42" y="71" width="14" height="11" rx="2" fill="#5c3310" />
        </Svg>
      );
    case 2:
      return (
        <Svg width="100%" height="100%" viewBox="0 0 80 86">
          <Path
            d="M24 18 C24 8 56 8 56 18 V28 H24 Z"
            fill="#3d2f6b"
          />
          <Head />
          <Path d="M26 18 Q40 8 54 18 Q40 14 26 18 Z" fill="#4a3a7a" />
          <Path
            d="M24 26 H56 C59 26 61 29 61 33 V50 C61 52 59 53 56 53 H24 C21 53 19 52 19 50 V33 C19 29 21 26 24 26 Z"
            fill="#4a3a7a"
            stroke={LINE}
            strokeWidth="0.8"
          />
          <Rect x="17" y="29" width="12" height="22" rx="5" fill="#3d2f6b" />
          <Rect x="51" y="29" width="12" height="22" rx="5" fill="#3d2f6b" />
          <Path d="M36 26 H44 V36 H36 Z" fill="#32285c" />
          <Path
            d="M23 51 H57 C60 51 62 54 62 57 V73 C62 75 59 76 56 76 H24 C21 76 18 75 18 73 V57 C18 54 20 51 23 51 Z"
            fill="#3a3a48"
          />
          <Rect x="23" y="73" width="15" height="9" rx="3" fill="#1a1a1a" />
          <Rect x="42" y="73" width="15" height="9" rx="3" fill="#1a1a1a" />
          <Rect x="23" y="80" width="15" height="2.2" rx="1" fill="#f3f3f3" />
          <Rect x="42" y="80" width="15" height="2.2" rx="1" fill="#f3f3f3" />
        </Svg>
      );
    case 3:
      return (
        <Svg width="100%" height="100%" viewBox="0 0 80 86">
          <Head />
          <Path
            d="M22 28 C24 24 28 26 31 27 H49 C52 26 56 24 58 28 L54 49 H26 Z"
            fill={SKIN}
          />
          <Path
            d="M30 26 H50 C51 26 52 27 52 29 V48 C52 49 51 50 49 50 H31 C29 50 28 49 28 48 V29 C28 27 29 26 30 26 Z"
            fill="#2c2c38"
            stroke={LINE}
            strokeWidth="0.8"
          />
          <Path d="M36 26 H44 V32 Q40 34 36 32 Z" fill={SKIN} />
          <Path
            d="M28 49 H52 C54 49 55 51 55 53 V73 C55 75 53 76 51 76 H29 C27 76 25 75 25 73 V53 C25 51 26 49 28 49 Z"
            fill="#1c1c28"
          />
          <Rect x="39" y="49" width="1.6" height="27" fill="#2a2a38" />
          <Ellipse cx="32" cy="79" rx="8" ry="4.5" fill="#8b6914" />
          <Ellipse cx="48" cy="79" rx="8" ry="4.5" fill="#8b6914" />
        </Svg>
      );
    default: {
      const exhaustive: never = outfit;
      return exhaustive;
    }
  }
};

export const OutfitCard = ({
  outfit,
  selected,
}: {
  outfit: OutfitIndex;
  selected: boolean;
}) => (
  <View style={styles.root}>
    <View style={styles.figure}>
      <OutfitFigure outfit={outfit} />
    </View>
    <Text
      style={[styles.caption, selected && styles.captionSelected]}
      numberOfLines={1}
    >
      {CAPTIONS[outfit]}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: s(4),
    paddingBottom: s(5),
    paddingHorizontal: s(2),
  },
  figure: {
    flex: 1,
    width: "100%",
  },
  caption: {
    marginTop: s(1),
    color: "rgba(243, 243, 243, 0.72)",
    fontFamily: "OpenSans-Bold",
    fontSize: 9,
    textAlign: "center",
  },
  captionSelected: {
    color: colors.white,
  },
});
