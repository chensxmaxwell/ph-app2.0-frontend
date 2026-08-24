import { useState, useCallback } from "react";
import uuid from "react-native-uuid";
import { LayoutChangeEvent } from "react-native";
import throttle from "lodash/throttle";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";
import { useHomeScreen } from "../../../../hooks/HomeScreenContext";

const MAX_TAIL_COMPONENTS = 5; // Define the maximum number of tail components
const ICON_OFFSET = 62;
const noXPadding = true;

const clamp = (val: number, min: number, max: number) => {
  return Math.min(Math.max(val, min), max);
};

export const useCanvas = () => {
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const prevTranslationX = useSharedValue(0);
  const prevTranslationY = useSharedValue(0);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isButtonOpen, setIsButtonOpen] = useState(false);
  const [tailType, setTailType] = useState<"circle" | "star">("circle");
  const [tailPositions, setTailPositions] = useState<
    { x: number; y: number; id: string }[]
  >([]);
  const { setCurrentMode, setMotorInput } = useHomeScreen();

  const handleAnimationEnd = (id: string) => {
    setTailPositions((prevPositions) =>
      prevPositions.filter((position) => position.id !== id)
    );
  };

  const throttledSetTailPositions = useCallback(
    throttle((newPosition) => {
      setTailPositions((prevPositions) => {
        const newPositions = [
          ...prevPositions,
          { ...newPosition, id: uuid.v4() },
        ];
        // Remove the oldest tail positions if the limit is exceeded
        if (newPositions.length > MAX_TAIL_COMPONENTS) {
          newPositions.shift();
        }
        return newPositions;
      });
    }, 30), // Adjust the throttle delay as needed
    []
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
  };

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .minDistance(1)
    .onStart(() => {
      prevTranslationX.value = translationX.value;
      prevTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      const { width, height } = dimensions;
      const maxTranslateX =
        width / 2 - (noXPadding ? ICON_OFFSET / 2 : ICON_OFFSET);
      const maxTranslateY = height - ICON_OFFSET;

      // const y = clamp(
      //   prevTranslationY.value + event.translationY,
      //   -maxTranslateY,
      //   0
      // );
      // const x = clamp(
      //   prevTranslationX.value + event.translationX,
      //   -maxTranslateX,
      //   maxTranslateX
      // );
      console.log({
        maxTranslateX,
        maxTranslateY,
        px: prevTranslationX.value + event.translationX,
        py: prevTranslationY.value + event.translationY,
      });

      translationX.value = prevTranslationX.value + event.translationX;
      translationY.value = prevTranslationY.value + event.translationY;
      // Boundary checks
      // if (x > 0 || x > width || y < 0 || y > height) {
      //   return;
      // }
      console.log({ event, width, height });
      // translateX.value = event.translationX;
      // translateY.value = event.translationY;
      // Add new tail position with unique id
      throttledSetTailPositions({
        x: event.x,
        y: event.y,
      });
      const canvasHeight = dimensions.height || 1;
      const level = Math.round(
        12 + (1 - Math.max(0, Math.min(1, event.y / canvasHeight))) * 88
      );
      setCurrentMode("canvas");
      setMotorInput([1, level, level, level]);
    })
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      setCurrentMode("");
      setMotorInput([]);
    })
    .runOnJS(true);

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  const handleSettingButtonClick = (open: boolean) => {
    setIsButtonOpen(open);
  };

  const handleSwitchTailType = () => {
    setTailType((prevType) => (prevType === "circle" ? "star" : "circle"));
    handleSettingButtonClick(false);
  };

  return {
    dimensions,
    onLayout,
    pan,
    animatedStyles,
    tailPositions,
    handleAnimationEnd,
    isButtonOpen,
    handleSettingButtonClick,
    handleSwitchTailType,
    tailType,
  };
};
