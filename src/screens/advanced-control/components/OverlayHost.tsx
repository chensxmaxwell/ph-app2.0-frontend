/**
 * Page-level overlay host for the advanced-control page: every sheet, dialog or
 * other overlay on this page must be rendered through <OverlayHost>, never
 * through a React Native <Modal> (a Modal draws above the whole page, including
 * Stop all).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ SAFETY RULE: Stop all is never hidden (design sign-off 2026-09-29, v4 §6)│
 * │                                                                          │
 * │ While any sheet or overlay on this page is open:                         │
 * │  1. Stop all stays visible and tappable, and is NOT dimmed by the scrim. │
 * │  2. The sheet's bottom edge stops just above Stop all. The host keeps a  │
 * │     reserved Stop-all zone (`reserveBottom`, stopZoneHeight()) free: the │
 * │     scrim and the sheet are both laid out above it.                      │
 * │  3. Stop all stays fixed above the scrim and the sheet, in exactly its   │
 * │     normal position and style. Never move it into a sheet. The page      │
 * │     renders <StopDock> after this host so it is the topmost layer.       │
 * │  4. Tapping Stop all while a sheet is open closes the sheet and enters   │
 * │     the e-stop state (ESTOP 1 -> Stopped + Unlock).                      │
 * │                                                                          │
 * │ Documented in docs/advanced-control-safety.md; covered by                │
 * │ __tests__/icd001/advanced-screen.test.tsx.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, View } from 'react-native';

import { reduceMotion } from '../motion';
import { v4 } from '../theme';

/** Gap between the sheet's bottom edge and the top of Stop all. */
export const STOP_ZONE_GAP = 12;
/** Height of the Stop all button (StopDock). */
export const STOP_BUTTON_H = 58;

/** Reserved Stop-all zone measured from the screen bottom (Stop all bottom + button + gap). */
export function stopZoneHeight(stopBottom: number): number {
  return stopBottom + STOP_BUTTON_H + STOP_ZONE_GAP;
}

/** Minimum gap between the last card and the top of the reserved Stop-all zone. */
export const CONTENT_ZONE_GAP = 12;

/**
 * Page scroll content bottom padding (safety net, design review 2026-10-04):
 * reserved Stop-all zone + 12 pt (108 + 12 = 120 pt on a 34 pt home-indicator
 * iPhone). Content taller than the screen scrolls; scrolled to the bottom the
 * last card always ends ≥ 12 pt above the zone, in every notice state.
 */
export function contentBottomPadding(stopBottom: number): number {
  return stopZoneHeight(stopBottom) + CONTENT_ZONE_GAP;
}

export const OverlayHost = ({
  visible,
  onClose,
  reserveBottom,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** stopZoneHeight(stopBottom): nothing in the host is laid out below this. */
  reserveBottom: number;
  children: React.ReactNode;
}) => {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      t.setValue(0);
      return;
    }
    if (reduceMotion()) {
      t.setValue(1);
      return;
    }
    const a = Animated.timing(t, {
      toValue: 1,
      duration: 260,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [t, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="overlay-host">
      <Animated.View style={[styles.scrimWrap, { bottom: reserveBottom, opacity: t }]} testID="overlay-scrim">
        <Pressable
          style={styles.fill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { bottom: reserveBottom, opacity: t, transform: [{ translateY }] }]}
        testID="overlay-sheet"
        accessibilityViewIsModal
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrimWrap: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: 'rgba(42,38,89,0.6)' },
  fill: { flex: 1 },
  /** No sheet is drawn in design v4; App surfaces: gradient-bottom base, card radius, no border/shadow. */
  sheet: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: v4.ink,
    borderRadius: v4.radius,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
});
