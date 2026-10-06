/**
 * Global "Auto on" pill (ICD001-1, PROTOCOL §11.3.7 / §11.6.3): the device
 * keeps following the body after the user leaves Manual, so every other page
 * shows it. Tap the pill = open Manual; tap the stop button = `STOP` (outputs
 * 0, device in manual, no latch: there is no Unlock on other pages; a later
 * BLE drop / HB timeout returns it to auto, §11.6.1). Hidden while a control
 * page is focused (it has the Auto | Manual control and Stop all).
 * Floats on the right edge like the Love / call pills, below them.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SCREENS } from '../../../common/constant';
import { useControlPageFocused, useIcd001 } from '../../../services/icd001';
import { getHomeStackNavigation } from '../../love/overlay';
import { autoPillVisible } from '../model';
import { text, v4 } from '../theme';

export const AutoPill = ({ onOpen }: { onOpen?: () => void }) => {
  const { state, client } = useIcd001();
  const focused = useControlPageFocused();
  if (!autoPillVisible(state, focused)) {
    return null;
  }
  const open =
    onOpen ??
    (() => {
      getHomeStackNavigation()?.navigate(SCREENS.MANUAL as never);
    });
  return (
    <View style={styles.pill} testID="auto-pill">
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Auto is on. Open Manual"
        hitSlop={6}
        style={styles.body}
        testID="auto-pill-open"
      >
        <View style={styles.dot} />
        <Text style={styles.label}>Auto on</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          client.stop().catch(() => undefined);
        }}
        accessibilityRole="button"
        accessibilityLabel="Stop Auto"
        hitSlop={6}
        style={styles.stop}
        testID="auto-pill-stop"
      >
        <View style={styles.square} />
      </Pressable>
    </View>
  );
};

export const GlobalAutoPill = () => (
  <View pointerEvents="box-none" collapsable={false} style={styles.host}>
    <AutoPill />
  </View>
);

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFillObject, zIndex: 50, elevation: 50 },
  pill: {
    position: 'absolute',
    right: 12,
    top: 280,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: v4.white,
    // Opaque (not the glass pill tint): it floats over cards and blobs on any page.
    backgroundColor: v4.accentDeep,
  },
  body: { flexDirection: 'row', alignItems: 'center', height: 40 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: v4.green, marginRight: 8 },
  label: text(14, v4.white, 18),
  stop: {
    marginLeft: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: v4.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: v4.ink },
});
