/**
 * Advanced control entry on the Control home (design v4 entry-row.png, spec §7).
 *
 * Shown only while an ICD1- / H11- device is connected. Everything about the
 * entry lives here so switching placement is a one-line change:
 *   ADVANCED_ENTRY_VARIANT = 'row'    full-width 90 pt glass row under the
 *                                     connection pill (design v4 (a), current)
 *   ADVANCED_ENTRY_VARIANT = 'corner' sliders icon at the top-right corner
 *                                     (design v4 (b)), no layout shift for the grid
 * Long-press opens the BLE debug screen in __DEV__ builds only.
 */
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SCREENS } from '@common/constant';

import { colors } from '../../common/styles/colors';
import { classifyDeviceName, useIcd001 } from '../../services/icd001';
import { BLOB } from '../advanced-control/assets';
import { Chevron, Icon } from '../advanced-control/icons';
import { text, v4 } from '../advanced-control/theme';

export type AdvancedEntryVariant = 'row' | 'corner';
export const ADVANCED_ENTRY_VARIANT: AdvancedEntryVariant = 'row';

/** entry-row.png: pill bottom 98 -> row 114..204 (x 27..363) -> card grid 220. */
const ROW = { above: 16, height: 90, side: 27, gridGap: 16 };

export function isAdvancedDevice(status: string, name: string | null | undefined): boolean {
  return status === 'connected' && classifyDeviceName(name) !== null;
}

export function useAdvancedEntryVisible(): boolean {
  const { state } = useIcd001();
  return isAdvancedDevice(state.status, state.device?.name);
}

/**
 * Card-grid top padding while the row takes flow space, or null to keep the
 * grid's own padding (entry hidden, or corner variant).
 */
export function useAdvancedEntryGridPaddingTop(): number | null {
  const visible = useAdvancedEntryVisible();
  return visible && ADVANCED_ENTRY_VARIANT === 'row' ? ROW.gridGap : null;
}

export const AdvancedEntry = ({ variant = ADVANCED_ENTRY_VARIANT }: { variant?: AdvancedEntryVariant }) => {
  const visible = useAdvancedEntryVisible();
  const navigation = useNavigation();
  if (!visible) {
    return null;
  }
  const open = () => navigation.navigate(SCREENS.ADVANCED_CONTROL as never);
  const debug = __DEV__ ? () => navigation.navigate(SCREENS.ICD001_DEBUG as never) : undefined;

  if (variant === 'corner') {
    return (
      <Pressable
        testID="advanced-entry"
        accessibilityRole="button"
        accessibilityLabel="Advanced control"
        onPress={open}
        onLongPress={debug}
        hitSlop={6}
        style={styles.corner}
      >
        <Icon name="sliders-horizontal" size={30} color={v4.white} />
      </Pressable>
    );
  }
  return (
    <Pressable
      testID="advanced-entry"
      accessibilityRole="button"
      accessibilityLabel="Advanced control. Each part on its own"
      onPress={open}
      onLongPress={debug}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Image source={BLOB.wings} style={styles.blob} />
      <View style={styles.titles}>
        <Text style={styles.t}>Advanced control</Text>
        <Text style={styles.s}>Each part on its own</Text>
      </View>
      <Chevron dir="right" size={24} color={v4.white} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    marginHorizontal: ROW.side,
    height: ROW.height,
    marginTop: ROW.above,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 14,
  },
  pressed: { opacity: 0.85 },
  blob: { width: 60, height: 60, marginRight: 16 },
  titles: { flex: 1 },
  t: text(14, v4.white, 18),
  s: { ...text(13, colors.grayLighter, 17), marginTop: 4 },
  corner: {
    position: 'absolute',
    top: 0,
    right: 20,
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
