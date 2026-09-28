/**
 * Emergency stop dock (design v2 §6.10): fixed bottom, always on top, always
 * enabled. One tap = ESTOP 1. When engaged it becomes "Stopped" + Release
 * (one tap = ESTOP 0, per design; the device START key also releases, §8.3).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Gradient from 'react-native-linear-gradient';

import { Icon } from '../icons';
import { nocturne as N, qs, text } from '../theme';

export const StopDock = ({
  engaged,
  bottom,
  onStop,
  onRelease,
}: {
  engaged: boolean;
  bottom: number;
  onStop: () => void;
  onRelease: () => void;
}) => (
  <>
    <Gradient
      pointerEvents="none"
      colors={['rgba(16,13,15,0)', 'rgba(16,13,15,0.92)', N.bgBottom]}
      locations={[0, 0.38, 0.6]}
      style={[styles.scrim, { height: 150 + Math.max(0, bottom - 38) }]}
    />
    {engaged ? (
      <View style={[styles.stop, styles.eng, { bottom }]} accessibilityLiveRegion="assertive">
        <View style={styles.engLeft} accessible accessibilityLabel="Emergency stop is on">
          <Icon name="octagon" size={22} color={N.stopEngInk} />
          <Text style={styles.engText}>Stopped</Text>
        </View>
        <Pressable
          onPress={onRelease}
          accessibilityRole="button"
          accessibilityLabel="Release emergency stop"
          style={({ pressed }) => [styles.rel, pressed && styles.pressed]}
        >
          <Text style={styles.relText}>Release</Text>
        </Pressable>
      </View>
    ) : (
      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel="Stop all outputs"
        style={({ pressed }) => [styles.stopWrap, { bottom }, pressed && styles.pressed]}
      >
        <Gradient colors={[N.stop, N.stop2]} style={styles.stop}>
          <View style={styles.hilite} pointerEvents="none" />
          <Icon name="octagon" size={22} color="#FFFFFF" />
          <Text style={styles.stopText}>Stop all</Text>
        </Gradient>
      </Pressable>
    )}
  </>
);

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  stopWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 58,
    borderRadius: N.radius.l,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  stop: {
    height: 58,
    borderRadius: N.radius.l,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hilite: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  stopText: { ...text(qs.bold, 17, '#FFFFFF'), letterSpacing: 0.2, marginLeft: 10 },
  eng: {
    position: 'absolute',
    left: 16,
    right: 16,
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 8,
    backgroundColor: N.stopEngBg,
    borderWidth: 1,
    borderColor: N.stopEngRing,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  engLeft: { flexDirection: 'row', alignItems: 'center' },
  engText: { ...text(qs.bold, 17, N.stopEngInk), marginLeft: 10 },
  rel: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: N.radius.s,
    backgroundColor: N.ink,
    justifyContent: 'center',
  },
  relText: text(qs.bold, 15, N.stopEngBg),
  pressed: { transform: [{ scale: 0.98 }] },
});
