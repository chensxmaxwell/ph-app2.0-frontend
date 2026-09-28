/** Device line (design v2 §6.2): advertised name, semantic dot, temperature + battery. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../icons';
import { nocturne as N, num, qs, text } from '../theme';

import type { DeviceView } from '../controller';

export const DeviceLine = ({ device, connecting }: { device: DeviceView; connecting: boolean }) => {
  const name = device.name ?? device.lastName ?? 'ICD-001';
  const state = device.connected ? 'Connected' : connecting ? 'Connecting' : 'Disconnected';
  return (
    <View style={styles.dev}>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.state} accessible accessibilityLabel={state}>
          <View style={[styles.dot, !device.connected && styles.dotOff]} />
          <Text style={styles.stateText}>{state}</Text>
        </View>
      </View>
      {device.connected ? (
        <View style={styles.meta}>
          <View style={styles.item} accessible accessibilityLabel={`Temperature ${device.tempText}`}>
            <Icon name="thermometer-simple" size={18} color={device.tempWarn ? N.warn : N.ink2} />
            <Text style={[num(15, device.tempWarn ? N.warn : N.ink2), styles.itemText]}>
              {device.tempText}
            </Text>
          </View>
          <View
            style={[styles.item, styles.gap]}
            accessible
            accessibilityLabel={`Battery ${device.batteryPct ?? 'unknown'} percent`}
          >
            <Icon
              name={device.batteryWarn ? 'battery-low' : 'battery-medium'}
              size={20}
              color={device.batteryWarn ? N.warn : N.ink2}
            />
            <Text style={[num(15, device.batteryWarn ? N.warn : N.ink2), styles.itemText]}>
              {device.batteryPct === null ? 'n/a' : `${device.batteryPct}%`}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  dev: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: N.pad,
    paddingBottom: 18,
  },
  left: { flexShrink: 1 },
  name: { ...text(qs.bold, 24, N.ink, 27), letterSpacing: -0.2 },
  state: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: N.ok, marginRight: 8 },
  dotOff: { backgroundColor: N.ink3 },
  stateText: text(qs.semiBold, 14, N.ink2, 17),
  meta: { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  item: { flexDirection: 'row', alignItems: 'center' },
  gap: { marginLeft: 16 },
  itemText: { marginLeft: 5 },
});
