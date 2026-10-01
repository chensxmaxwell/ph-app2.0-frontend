/**
 * Stop all dock (design v4 §1, §6): fixed bottom, the topmost layer, never
 * dimmed, always pressable. A solid App-white full-round pill with ink text
 * and a stop glyph (the highest-contrast element in the App's own system; red
 * appears only as the status dot once Stopped). One tap = ESTOP 1. When engaged
 * it becomes a glass pill "● Stopped" + white "Unlock" (one tap = ESTOP 0; the
 * device START key also unlocks, PROTOCOL §8.3).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Gradient from 'react-native-linear-gradient';

import { text, v4 } from '../theme';

import { STOP_BUTTON_H, stopZoneHeight } from './OverlayHost';

export const StopDock = ({
  engaged,
  bottom,
  overlayOpen,
  onStop,
  onRelease,
}: {
  engaged: boolean;
  bottom: number;
  /**
   * A sheet/overlay is open (OverlayHost). The dock stays exactly where and how
   * it is; only its backdrop becomes an opaque, touch-blocking Stop-all zone so
   * the page underneath neither shows through nor receives taps.
   */
  overlayOpen?: boolean;
  onStop: () => void;
  onRelease: () => void;
}) => (
  <>
    {overlayOpen ? (
      <View style={[styles.zone, styles.zoneSolid, { height: stopZoneHeight(bottom) }]} testID="stop-zone" />
    ) : (
      /* Reserved 108 pt zone (38 + 58 + 12) filled with the gradient bottom so scrolled content fades under it. */
      <Gradient
        pointerEvents="none"
        colors={['rgba(42,38,89,0)', 'rgba(42,38,89,0.92)', v4.ink]}
        locations={[0, 0.34, 0.6]}
        style={[styles.zone, { height: stopZoneHeight(bottom) }]}
      />
    )}
    {engaged ? (
      <View
        style={[styles.pill, styles.held, { bottom }]}
        accessibilityLiveRegion="assertive"
        testID="stopped"
      >
        <View style={styles.heldLeft} accessible accessibilityLabel="Stopped. All outputs are off">
          <View style={styles.dot} />
          <Text style={styles.heldText}>Stopped</Text>
        </View>
        <Pressable
          onPress={onRelease}
          accessibilityRole="button"
          accessibilityLabel="Unlock"
          testID="unlock"
          style={({ pressed }) => [styles.unlock, pressed && styles.pressed]}
        >
          <Text style={styles.unlockText}>Unlock</Text>
        </Pressable>
      </View>
    ) : (
      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel="Stop all outputs"
        testID="stop-all"
        style={({ pressed }) => [styles.pill, styles.go, { bottom }, pressed && styles.pressed]}
      >
        <View style={styles.sq} />
        <Text style={styles.goText}>Stop all</Text>
      </Pressable>
    )}
  </>
);

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  zoneSolid: { backgroundColor: v4.ink },
  pill: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: STOP_BUTTON_H,
    borderRadius: STOP_BUTTON_H / 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  go: { backgroundColor: v4.white, justifyContent: 'center' },
  sq: { width: 14, height: 14, borderRadius: 3, backgroundColor: v4.ink, marginRight: 10 },
  goText: text(18, v4.ink),
  held: {
    backgroundColor: v4.pill,
    borderWidth: 1,
    borderColor: v4.white,
    justifyContent: 'space-between',
    paddingLeft: 22,
    paddingRight: 8,
  },
  heldLeft: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 5, backgroundColor: v4.red, marginRight: 10 },
  heldText: text(16),
  unlock: {
    height: 42,
    paddingHorizontal: 24,
    borderRadius: 21,
    backgroundColor: v4.white,
    justifyContent: 'center',
  },
  unlockText: text(16, v4.ink),
  pressed: { opacity: 0.85 },
});
