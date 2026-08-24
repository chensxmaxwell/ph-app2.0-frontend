import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { TailProps } from ".";

export const useTail = ({ onAnimationEnd }: TailProps) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scaleValue, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    Animated.timing(opacityValue, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      // Animation end callback
      onAnimationEnd();
    });
  }, [scaleValue, opacityValue]);

  return {
    scaleValue,
    opacityValue,
  };
};
