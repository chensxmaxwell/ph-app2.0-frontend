import { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";
import { DraggableCircleProps } from ".";
import { useState } from "react";
import { LayoutChangeEvent } from "react-native";

const ICON_OFFSET = 62;

export const useDraggableCircle = ({
  height = 620,
  width = 500,
  handleDragging,
  handleStart,
  noXPadding,
}: DraggableCircleProps) => {
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const prevTranslationX = useSharedValue(0);
  const prevTranslationY = useSharedValue(0);
  const initialX = useSharedValue(0);
  const initialY = useSharedValue(0);
  const [currentIconPosition, setCurrentIconPosition] = useState({
    x: 0,
    y: 0,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { x, y } = event.nativeEvent.layout;
    setCurrentIconPosition({ x, y });
  };

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
    ],
  }));

  function clamp(val: number, min: number, max: number) {
    return Math.min(Math.max(val, min), max);
  }

  const pan = Gesture.Pan()
    .minDistance(1)
    .onStart((event) => {
      prevTranslationX.value = translationX.value;
      prevTranslationY.value = translationY.value;
      initialX.value = event.absoluteX - translationX.value;
      initialY.value = event.absoluteY - translationY.value;
      handleStart && handleStart();
    })
    .onUpdate((event) => {
      const maxTranslateX =
        width / 2 - (noXPadding ? ICON_OFFSET / 2 : ICON_OFFSET);
      const maxTranslateY = height - ICON_OFFSET;

      const y = clamp(
        prevTranslationY.value + event.translationY,
        -maxTranslateY,
        0
      );
      const x = clamp(
        prevTranslationX.value + event.translationX,
        -maxTranslateX,
        maxTranslateX
      );

      translationX.value = x;
      translationY.value = y;

      const proportionalX = ((x + maxTranslateX) / (2 * maxTranslateX)) * 100;
      const proportionalY = 100 - ((y + maxTranslateY) / maxTranslateY) * 100;

      // Calculate the actual position of the icon on the screen
      const absoluteX = currentIconPosition.x + x + ICON_OFFSET / 2;
      const absoluteY = currentIconPosition.y + y + ICON_OFFSET / 2;

      if (handleDragging)
        handleDragging({
          x,
          absoluteX,
          proportionalX,
          y,
          absoluteY,
          proportionalY,
        });
    })
    .runOnJS(true);

  return {
    animatedStyles,
    pan,
    handleLayout,
  };
};
