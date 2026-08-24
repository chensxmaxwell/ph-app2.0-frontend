import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  FlatList,
  ListRenderItem,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { ControlType, useControl } from "./hooks";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { FULL_SIZE } from "@common/constant";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { BaseText } from "@common/components/base-text";
import { spacings } from "@common/styles/spacings";
import { ConnectionPill } from "@common/components/connection-pill";

const AutoRing = ({ active }: { active: boolean }) => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [active, spin]);

  if (!active) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.autoRing,
        {
          transform: [
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
          ],
        },
      ]}
    />
  );
};

export const Control = () => {
  const { controls, autoOn, autoIntensity, setAutoIntensity } = useControl();

  const renderControls: ListRenderItem<ControlType> = ({ item }) => {
    const { title, Icon, onPress, active, id } = item;
    const isAuto = id === "auto";

    return (
      <View style={[styles.cards, active ? styles.cardOn : null]}>
        <TouchableOpacity
          style={styles.cardHit}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <View style={styles.iconStage}>
            {isAuto ? <AutoRing active={Boolean(active)} /> : null}
            <Icon />
          </View>
          <BaseText style={styles.controlTitle}>{title}</BaseText>
        </TouchableOpacity>
        {isAuto && autoOn ? (
          <View style={styles.intensityRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity
                key={value}
                hitSlop={8}
                style={[
                  styles.intensityDot,
                  value <= autoIntensity ? styles.intensityDotOn : null,
                ]}
                onPress={() => setAutoIntensity(value)}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <ConnectionPill />
        <FlatList
          data={controls}
          renderItem={renderControls}
          keyExtractor={(item) => item.id}
          extraData={`${autoOn}-${autoIntensity}`}
          numColumns={2}
          contentContainerStyle={styles.cardContainer}
          columnWrapperStyle={styles.columnWrapper}
        />
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: "visible",
    width: FULL_SIZE,
    display: "flex",
    alignItems: "center",
  },
  cardContainer: {
    paddingTop: spacings.h85,
    gap: spacings.h16,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  cards: {
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: spacings.w18,
    minWidth: 160,
    minHeight: 156,
    marginHorizontal: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: spacings.h16,
  },
  cardHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  cardOn: {
    borderWidth: 1,
    borderColor: colors.accentLightPink,
  },
  iconStage: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  autoRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "rgba(204, 160, 221, 0.25)",
    borderTopColor: colors.white,
    borderRightColor: colors.accentLightPink,
  },
  controlTitle: {
    fontWeight: fontWeights.bold,
    flexWrap: "wrap",
    color: colors.white,
    fontSize: fontSizes.smallX,
  },
  intensityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  intensityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.grayLightest,
  },
  intensityDotOn: {
    backgroundColor: colors.accentLightPink,
  },
});
