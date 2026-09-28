/**
 * Product stage (design v2 §6.1): re-lit ICD-001 on the warm-black pool.
 * Part tinting: RN has no mix-blend-mode, so the pre-tinted PNGs (#CCA0DD +
 * alpha, pixel-aligned with hero.png) are layered with opacity. Tapping a part
 * opens its row; hit boxes are the part mask bounding boxes (min 44 pt).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, GestureResponderEvent, Pressable, StyleSheet } from 'react-native';

import { HERO_PT, IMG } from '../assets';
import { reduceMotion } from '../motion';

import type { AdvancedControlView, StagePart } from '../controller';

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const FULL = { h: 256, w: 358, top: 44 };
const COMPACT = { h: 176, w: 300, top: 14 };
const PRODUCT_RATIO = 169 / 358;

/** Hit boxes in hero image points (390 x 184), priority order head > egg > upper > lower. */
export const STAGE_HITS: ReadonlyArray<{ part: StagePart; x: number; y: number; w: number; h: number }> = [
  { part: 'head', x: 163, y: 60.75, w: 44, h: 44 },
  { part: 'bullet', x: 300, y: 5, w: 79, h: 45.5 },
  { part: 'upper', x: 125, y: 60.5, w: 121.5, h: 44 },
  { part: 'lower', x: 11, y: 93, w: 347.5, h: 74 },
];

export function partAt(px: number, py: number): StagePart | null {
  for (const h of STAGE_HITS) {
    if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) {
      return h.part;
    }
  }
  return null;
}

function useTo(value: number, ms: number) {
  const a = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    if (reduceMotion() || ms === 0) {
      a.setValue(value);
      return;
    }
    const anim = Animated.timing(a, { toValue: value, duration: ms, easing: EASE, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [a, value, ms]);
  return a;
}

export const Stage = ({
  stage,
  width,
  onSelect,
}: {
  stage: AdvancedControlView['stage'];
  width: number;
  onSelect: (p: StagePart) => void;
}) => {
  const k = useTo(stage.compact ? 1 : 0, 200);
  const dim = useTo(stage.dim ? 1 : 0, 200);
  const tA = useTo(stage.tint.upper, 150);
  const tB = useTo(stage.tint.lower, 150);
  const tH = useTo(stage.tint.head, 150);
  const tE = useTo(stage.tint.egg, 150);

  const height = k.interpolate({ inputRange: [0, 1], outputRange: [FULL.h, COMPACT.h] });
  const pw = k.interpolate({ inputRange: [0, 1], outputRange: [FULL.w, COMPACT.w] });
  const ph = k.interpolate({
    inputRange: [0, 1],
    outputRange: [FULL.w * PRODUCT_RATIO, COMPACT.w * PRODUCT_RATIO],
  });
  const top = k.interpolate({ inputRange: [0, 1], outputRange: [FULL.top, COMPACT.top] });
  const left = k.interpolate({
    inputRange: [0, 1],
    outputRange: [(width - FULL.w) / 2, (width - COMPACT.w) / 2],
  });
  const box = { position: 'absolute' as const, left, top, width: pw, height: ph };

  const onPress = (e: GestureResponderEvent) => {
    const cur = stage.compact ? COMPACT : FULL;
    const x0 = (width - cur.w) / 2;
    const s = HERO_PT.w / cur.w;
    const part = partAt((e.nativeEvent.locationX - x0) * s, (e.nativeEvent.locationY - cur.top) * s);
    if (part) {
      onSelect(part);
    }
  };

  return (
    <Animated.View style={[styles.stage, { height }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel="ICD-001. Tap wings, head or bullet to open its controls."
      >
        <Animated.Image
          source={IMG.hero}
          style={[box, { opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
          resizeMode="stretch"
        />
        <Animated.Image
          source={IMG.heroDim}
          style={[box, { opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.34] }) }]}
          resizeMode="stretch"
        />
        <Animated.Image source={IMG.tintB} style={[box, { opacity: tB }]} resizeMode="stretch" />
        <Animated.Image source={IMG.tintA} style={[box, { opacity: tA }]} resizeMode="stretch" />
        <Animated.Image source={IMG.tintHead} style={[box, { opacity: tH }]} resizeMode="stretch" />
        <Animated.Image source={IMG.tintEgg} style={[box, { opacity: tE }]} resizeMode="stretch" />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  stage: { marginTop: 4, overflow: 'hidden' },
});
