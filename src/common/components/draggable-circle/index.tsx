import React from "react";
import { View, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import IndicatorIcon from "@images/icons/indicator-icon.svg";
import { BaseText } from "@common/components/base-text";
import { fontWeights } from "@common/styles/fonts";
import { useDraggableCircle } from "./hooks";

export const DraggableCircle: React.FC<DraggableCircleProps> = (props) => {
  const { animatedStyles, pan } = useDraggableCircle(props);

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.circle, animatedStyles]}>
          <View>
            <IndicatorIcon />
            <BaseText style={{ fontWeight: fontWeights.bold }}>PH1</BaseText>
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

export type HandleDraggingProps = {
  x: number;
  absoluteX: number;
  proportionalX: number;
  y: number;
  absoluteY: number;
  proportionalY: number;
};
export type DraggableCircleProps = {
  height?: number;
  width?: number;
  handleDragging: ({
    x,
    absoluteX,
    proportionalX,
    y,
    absoluteY,
    proportionalY,
  }: HandleDraggingProps) => void;
  handleStart?: () => void;
  handleLayout?: () => void;
  noXPadding?: boolean;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  circle: {
    width: 62,
    height: 62,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6C63FF",
  },
  // Additional styles for lines and text
});
