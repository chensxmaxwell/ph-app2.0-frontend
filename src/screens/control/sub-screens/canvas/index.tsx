import { ScreenWrapper } from "@common/components/screen-wrapper";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Fire from "@images/icons/fire.svg";
import Xmark from "@images/icons/xmark-white.svg";
import Star from "@images/icons/star.svg";
import Repeaet from "@images/icons/repeat.1.svg";
import LinearGradient from "react-native-linear-gradient";
import Lightbulb from "@images/icons/lightbulb.svg";
import { BaseText } from "@common/components/base-text";
import { BackButton } from "@common/components/back-button";
import { FULL_SIZE } from "@common/constant";
import { spacings } from "@common/styles/spacings";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { Tail } from "./sub-components/tail";
import { useCanvas } from "./hooks";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

export const Canvas = () => {
  const {
    onLayout,
    pan,
    tailPositions,
    handleAnimationEnd,
    isButtonOpen,
    handleSettingButtonClick,
    handleSwitchTailType,
    tailType,
  } = useCanvas();
  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <BackButton />
          <BaseText style={styles.titleText}>Pleasure canvas</BaseText>
          <TouchableOpacity onPress={() => {}}>
            <Lightbulb />
          </TouchableOpacity>
        </View>
        <View
          style={{
            height: FULL_SIZE,
            width: "90%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            onLayout={onLayout}
            style={{
              backgroundColor: "rgba(43, 35, 88, 1)",
              height: "70%",
              width: "90%",
              borderRadius: 20,
            }}
          >
            <GestureHandlerRootView>
              {tailPositions.map((position) => (
                <View
                  key={position.id}
                  style={[
                    styles.tail,
                    { left: position.x - 31, top: position.y - 31 }, // Adjust for the size of the tail component
                  ]}
                >
                  <Tail
                    shape={tailType}
                    onAnimationEnd={() => handleAnimationEnd(position.id)}
                  />
                </View>
              ))}
              <GestureDetector gesture={pan}>
                <View style={{ height: FULL_SIZE, width: FULL_SIZE }}>
                  {isButtonOpen ? (
                    <View style={styles.grayIndicatorContainer}>
                      <TouchableOpacity
                        style={styles.innerContainer}
                        onPress={() => handleSwitchTailType()}
                      >
                        <Star />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.innerContainer}>
                        <Repeaet />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.innerContainer}
                        onPress={() => handleSettingButtonClick(false)}
                      >
                        <Xmark />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={["#CCA0DD", "#5E5DBF"]}
                      start={{ x: 0.9262, y: 0.0951 }}
                      end={{ x: 0.214, y: 0.9262 }}
                      style={styles.gradientBorder}
                    >
                      <TouchableOpacity
                        style={styles.indicatorContainer}
                        onPress={() => handleSettingButtonClick(true)}
                      >
                        <View style={styles.innerContainer}>
                          <Fire />
                        </View>
                      </TouchableOpacity>
                    </LinearGradient>
                  )}
                </View>
              </GestureDetector>
            </GestureHandlerRootView>
          </View>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: "hidden",
    width: FULL_SIZE,
    display: "flex",
    alignItems: "center",
  },
  titleContainer: {
    width: FULL_SIZE,
    paddingHorizontal: spacings.w16,
    paddingTop: spacings.h16,
    paddingBottom: spacings.h34,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleText: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
  },
  gradientBorder: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    left: spacings.w24,
    bottom: spacings.h24,
  },
  indicatorContainer: {
    width: 50,
    height: 50,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43, 35, 88, 1)",
  },
  grayIndicatorContainer: {
    left: spacings.w32,
    bottom: spacings.h34,
    position: "absolute",
    gap: 20,
  },
  innerContainer: {
    // Background color of the inner container
    borderRadius: 45, // Adjust the border radius to match the gradient border
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(243, 243, 243, 0.3)",
    width: 40,
    height: 40,
  },
  tail: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
