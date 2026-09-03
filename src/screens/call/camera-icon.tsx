import React from "react";
import Svg, { Line, Path, Rect } from "react-native-svg";

// Video toggle glyph. Figma has no camera icon in the call frames, so this is
// a two-shape camera drawn to the same 35 pt box the other call icons use.
export const CameraIcon = ({
  size,
  off = false,
}: {
  size: number;
  off?: boolean;
}) => (
  <Svg width={size} height={size} viewBox="0 0 35 35" fill="none">
    <Rect
      x="4"
      y="10"
      width="18"
      height="15"
      rx="3"
      stroke="#F3F3F3"
      strokeWidth="2"
    />
    <Path
      d="M22 15.5 L30 11 V24 L22 19.5 Z"
      stroke="#F3F3F3"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {off ? (
      <Line
        x1="6"
        y1="29"
        x2="29"
        y2="6"
        stroke="#F3F3F3"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ) : null}
  </Svg>
);
