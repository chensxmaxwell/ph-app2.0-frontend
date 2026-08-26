import { ImageStyle, ViewStyle } from "react-native";

export const ROW_AVATAR_SIZE = 70;

export const circleAvatarStyle = (size: number): ViewStyle => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  overflow: "hidden",
  flexShrink: 0,
  aspectRatio: 1,
});

export const circleAvatarFillStyle = (size: number): ImageStyle & ViewStyle => ({
  width: size,
  height: size,
});
