import React from "react";
import { Animated, StyleSheet } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { useTail } from "./hooks";

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export const Tail = (props: TailProps) => {
  const { scaleValue, opacityValue } = useTail(props);
  const { shape = "circle" } = props;

  return (
    <>
      {shape === "star" ? (
        <AnimatedSvg
          width="70"
          height="70"
          style={[
            styles.animatedSvg,
            {
              transform: [{ scale: scaleValue }],
              opacity: opacityValue,
            },
          ]}
        >
          <Polygon
            points="31,5 37,22 55,22 40,32 45,50 31,40 17,50 22,32 7,22 25,22"
            fill="#6C63FF"
          />
        </AnimatedSvg>
      ) : (
        <Animated.View
          style={[
            styles.animatedDiv,
            {
              transform: [{ scale: scaleValue }],
              opacity: opacityValue,
            },
          ]}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  animatedDiv: {
    width: 62,
    height: 62,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6C63FF",
  },
  animatedSvg: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
});

export type TailProps = {
  onAnimationEnd: () => void;
  shape?: "circle" | "star";
};
