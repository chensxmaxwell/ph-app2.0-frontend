/**
 * Advanced control entry on the Control home (design v2 png 01, decision Q9).
 *
 * Shown only while an ICD1- / H11- device is connected. Everything about the
 * entry lives here so switching placement is a one-line change:
 *   ADVANCED_ENTRY_VARIANT = 'row'    full-width row with product thumb under the
 *                                     connection pill (design v2, current)
 *   ADVANCED_ENTRY_VARIANT = 'corner' small chip at the top-right corner (the
 *                                     original ask), no layout shift for the grid
 * Long-press opens the BLE debug screen in __DEV__ builds only.
 */
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SCREENS } from '@common/constant';

import { classifyDeviceName, useIcd001 } from '../../services/icd001';
import { IMG } from '../advanced-control/assets';
import { Icon } from '../advanced-control/icons';
import { nocturne as N, qs, text } from '../advanced-control/theme';

export type AdvancedEntryVariant = 'row' | 'corner';
export const ADVANCED_ENTRY_VARIANT: AdvancedEntryVariant = 'row';

/** png 01: pill bottom 97 -> row 112..172 -> card grid 188. */
const ROW = { above: 15, height: 60, gridGap: 16 };

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
        style={styles.corner}
      >
        <Text style={styles.cornerText}>Advanced</Text>
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
      <Image source={IMG.heroThumb} style={styles.thumb} resizeMode="contain" />
      <View style={styles.titles}>
        <Text style={styles.t}>Advanced control</Text>
        <Text style={styles.s}>Each part on its own</Text>
      </View>
      <Icon name="caret-right" size={18} color={N.ink} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    marginHorizontal: 23,
    height: ROW.height,
    marginTop: ROW.above,
    borderRadius: 10,
    backgroundColor: 'rgba(19,16,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(243,243,243,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 14,
  },
  pressed: { backgroundColor: 'rgba(19,16,18,0.7)' },
  thumb: { width: 96, height: 45 },
  titles: { flex: 1, marginLeft: 10 },
  t: text(qs.bold, 15, N.ink, 19),
  s: { ...text(qs.medium, 13, 'rgba(243,243,243,0.72)', 16), marginTop: 2 },
  corner: {
    position: 'absolute',
    top: 8,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243,243,243,0.9)',
  },
  cornerText: text(qs.semiBold, 13, N.ink),
});
