import React, { useRef } from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
} from "react-native-svg";
import {
  AvatarLook,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_COLORS,
} from "./engine/viewer-html";
import { toHairStyle } from "./hair-style-icon";
import { toOutfitIndex } from "./outfit-card";
import { circleAvatarFillStyle, circleAvatarStyle } from "./circle-avatar";

const FACE = require("../../../assets/images/love/face.png");

const OUTFIT_ACCENTS = ["#3d6cb0", "#6b7c4f", "#4a3a7a", "#2c2c38"] as const;

let lookFaceClipSeq = 0;

const HairCap = ({
  style,
  color,
}: {
  style: 0 | 1 | 2 | 3;
  color: string;
}) => {
  switch (style) {
    case 0:
      return (
        <Path
          d="M18 22 C18 10 46 10 46 22 C44 16 20 16 18 22 Z"
          fill={color}
        />
      );
    case 1:
      return (
        <Path
          d="M16 28 C14 10 36 6 48 16 C40 12 28 14 22 28 Z"
          fill={color}
        />
      );
    case 2:
      return (
        <>
          <Ellipse cx="32" cy="20" rx="18" ry="12" fill={color} />
          <Path d="M14 22 H50 V30 C48 26 16 26 14 30 Z" fill={color} />
        </>
      );
    case 3:
      return (
        <Path
          d="M12 26 C14 8 50 8 52 26 C50 18 14 18 12 26 Z"
          fill={color}
        />
      );
    default: {
      const exhaustive: never = style;
      return exhaustive;
    }
  }
};

export const LookFace = ({
  look,
  size,
  fallbackSource = FACE,
}: {
  look?: AvatarLook | null;
  size: number;
  fallbackSource?: ImageSourcePropType;
}) => {
  const clipId = useRef(`lookFaceClip${lookFaceClipSeq++}`).current;

  if (!look) {
    return (
      <View style={[styles.clip, circleAvatarStyle(size)]}>
        <Image
          source={fallbackSource}
          resizeMode="cover"
          style={circleAvatarFillStyle(size)}
        />
      </View>
    );
  }

  const skin = SKIN_COLORS[look.skinTone] ?? SKIN_COLORS[1];
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
  const eyes = EYE_COLORS[look.eyeColor] ?? EYE_COLORS[0];
  const outfit = OUTFIT_ACCENTS[toOutfitIndex(look.appearanceIndex)];
  const hairStyle = toHairStyle(look.hairStyle);

  return (
    <View style={[styles.clip, circleAvatarStyle(size)]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        preserveAspectRatio="xMidYMid slice"
        style={circleAvatarFillStyle(size)}
      >
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx="32" cy="32" r="32" />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <Circle cx="32" cy="32" r="32" fill={skin} />
          <HairCap style={hairStyle} color={hair} />
          <Circle cx="24" cy="34" r="3.2" fill={eyes} />
          <Circle cx="40" cy="34" r="3.2" fill={eyes} />
          <Path d="M0 48 C18 42 46 42 64 48 V64 H0 Z" fill={outfit} />
          <Path
            d="M22 46 C28 50 36 50 42 46"
            stroke="rgba(20,16,40,0.28)"
            strokeWidth="1.6"
            fill="none"
          />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
