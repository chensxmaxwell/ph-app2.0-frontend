import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { FULL_SIZE } from "@common/constant";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { BaseText } from "@common/components/base-text";
import { spacings } from "@common/styles/spacings";
import { BackButton } from "@common/components/back-button";
import Loop from "@images/icons/loop.svg";
import StopCircle from "@images/icons/stop-circle.svg";
// import { BlurView } from '@react-native-community/blur';

import { VibrationGraph, PatternType } from "../vibration-graph";
import { useCreatePattern } from "./hooks";
import { DraggableCircle } from "../../../../../../common/components/draggable-circle";

export const CreatePattern: React.FC = () => {
  const {
    start,
    displayPattern,
    handleDragging,
    handleStart,
    dimensions,
    onLayout,
    countup,
    handleSavePress,
  } = useCreatePattern({ pattern: new Array(30).fill(0) });

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <BackButton />
          <BaseText style={styles.titleText}>Create pattern</BaseText>
          <TouchableOpacity onPress={handleSavePress}>
            <BaseText style={styles.saveText}>Save</BaseText>
          </TouchableOpacity>
        </View>
        <VibrationGraph pattern={displayPattern} start={start} height={100} />
        <View style={styles.bottomContainer}>
          <View style={styles.timerContainer}>
            <BaseText>{countup}</BaseText>
          </View>
          <View style={styles.gestureAreaContainer}>
            {/* <BlurView
                            style={styles.absolute}r
                            blurType="dark"
                            blurAmount={4}
                        /> */}
            <View style={styles.scaleContainer} onLayout={onLayout}>
              {/* Scale indicator */}
              <View style={styles.scaleIndicator}>
                {[...Array(11)].map((_, index) => (
                  <View
                    key={index}
                    style={{ flexDirection: "row", alignItems: "center" }}
                  >
                    <View
                      style={[
                        styles.scaleMark,
                        index === 0 && styles.firstScaleMark,
                      ]}
                    />
                    {index === 10 && (
                      <BaseText style={styles.scaleNumber}>0%</BaseText>
                    )}
                    {index === 0 && (
                      <BaseText style={styles.scaleNumber}>100%</BaseText>
                    )}
                  </View>
                ))}
              </View>
              <DraggableCircle
                {...dimensions}
                handleDragging={handleDragging}
                handleStart={handleStart}
              />
            </View>
            <View style={styles.rightSide}>
              <View style={styles.modeControl}>
                <View>
                  <Loop />
                  <BaseText style={styles.modeControlText}>Loop</BaseText>
                </View>
                <View>
                  <StopCircle />
                  <BaseText style={styles.modeControlText}>Float</BaseText>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export type DisplayPatternScreenProps = {
  pattern: PatternType;
  title: string;
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: "hidden",
    width: FULL_SIZE,
    display: "flex",
    alignItems: "center",
  },
  absolute: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
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
    fontSize: fontSizes.large,
    fontWeight: fontWeights.bold,
  },
  saveText: {
    color: colors.white,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    lineHeight: 16.25,
    fontFamily: "Quicksand",
  },
  modeControlText: {
    fontWeight: fontWeights.bold,
  },
  bottomContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    width: FULL_SIZE,
    height: FULL_SIZE,
    backgroundColor: "rgba(43, 35, 88, 0.3)",
  },
  timerContainer: {
    height: spacings.h50,
    alignSelf: "center",
    justifyContent: "center",
  },
  gestureAreaContainer: {
    display: "flex",
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.white,
    marginBottom: spacings.h50,
  },
  rightSide: {
    borderLeftWidth: 1,
    borderLeftColor: colors.white,
  },
  modeControl: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-around",
    paddingHorizontal: spacings.w16,
  },
  scaleContainer: {
    flex: 1,
    flexDirection: "row",
  },
  scaleIndicator: {
    width: 50,
    justifyContent: "space-around",
    height: "100%",
  },
  scaleMark: {
    width: spacings.w12,
    height: 2,
    backgroundColor: colors.white,
  },
  firstScaleMark: {
    width: spacings.w12,
    backgroundColor: colors.white,
  },
  scaleNumber: {
    paddingLeft: spacings.w5,
    color: colors.white,
    fontWeight: fontWeights.bold,
  },
});
