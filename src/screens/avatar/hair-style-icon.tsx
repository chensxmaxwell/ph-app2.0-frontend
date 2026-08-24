import React from "react";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";
import { HairStyleIndex } from "./engine/viewer-html";

type HairStyleIconProps = {
  style: HairStyleIndex;
  color: string;
  size: number;
};

const HAIR_STYLES: HairStyleIndex[] = [0, 1, 2, 3];

export const toHairStyle = (index: number): HairStyleIndex =>
  HAIR_STYLES[((index % 4) + 4) % 4] ?? 2;

export const HairStyleIcon = ({ style, color, size }: HairStyleIconProps) => {
  switch (style) {
    case 0:
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Ellipse cx="32" cy="18" rx="10" ry="8" fill={color} />
          <Ellipse cx="32" cy="32" rx="16" ry="12" fill={color} />
        </Svg>
      );
    case 1:
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Path
            d="M36 12 C22 10 10 22 12 40 C16 50 24 40 34 32 C50 26 50 16 36 12 Z"
            fill={color}
          />
        </Svg>
      );
    case 2:
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Ellipse cx="32" cy="28" rx="22" ry="16" fill={color} />
          <Rect x="12" y="30" width="40" height="14" rx="4" fill={color} />
        </Svg>
      );
    case 3:
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Ellipse cx="32" cy="30" rx="18" ry="12" fill={color} />
        </Svg>
      );
    default: {
      const exhaustive: never = style;
      return exhaustive;
    }
  }
};
