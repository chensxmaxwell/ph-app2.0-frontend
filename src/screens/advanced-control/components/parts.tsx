/**
 * Small v4 pieces: module card with head row, Pulse switch, and the page's
 * connection pill (ConnectionPill look, bound to the ICD-001 link).
 */
import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import { text, v4 } from '../theme';

/** Card (Control / Playground card style) with a 36 pt head: blob 44, title 14, right slot. */
export const ModuleCard = ({
  blob,
  title,
  right,
  children,
  testID,
}: {
  blob: ImageSourcePropType;
  title: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  testID?: string;
}) => (
  <View style={styles.card} testID={testID}>
    <View style={styles.head}>
      <Image source={blob} style={styles.blob} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
    {children}
  </View>
);

/**
 * Pulse on/off (spec §2: RN Switch geometry 51x31, track grayLightest / accent,
 * flat white 27 thumb). Drawn as a view so it looks the same on iOS and Android.
 */
export const PulseSwitch = ({
  value,
  onChange,
  disabled,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) => (
  <View style={styles.swRow}>
    <Text style={styles.swText}>{value ? 'On' : 'Off'}</Text>
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.sw, value && styles.swOn]}
      testID="pulse-switch"
    >
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  </View>
);

/**
 * ConnectionPill look (connection-pill/index.tsx: minH 40 -> 42 per spec, minW
 * 150, r35, 1 px white, grayLightest, 7 px dot) but driven by the ICD-001 link,
 * not the legacy HomeScreen context. Text in Quicksand-Bold (spec §8.7).
 * Tap while disconnected = reconnect.
 */
export const LinkPill = ({
  connected,
  connecting,
  batteryPct,
  onPress,
}: {
  connected: boolean;
  connecting: boolean;
  batteryPct: number | null;
  onPress?: () => void;
}) => {
  const label = connecting
    ? 'Connecting…'
    : connected
    ? `Connected${batteryPct !== null ? `  ${batteryPct}%` : ''}`
    : 'Disconnected';
  return (
    <Pressable
      onPress={connected || connecting ? undefined : onPress}
      disabled={connected || connecting}
      accessibilityRole={connected ? undefined : 'button'}
      accessibilityLabel={connected ? label : `${label}. Reconnect`}
      style={styles.pill}
      testID="link-pill"
    >
      <View style={[styles.dot, { backgroundColor: connected ? v4.green : v4.red }]} />
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: v4.card, borderRadius: v4.radius, padding: 16 },
  head: { height: 36, flexDirection: 'row', alignItems: 'center' },
  blob: { width: 44, height: 44, marginLeft: -4, marginRight: 10, marginVertical: -4 },
  title: text(14, v4.white, 18),
  right: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  swRow: { flexDirection: 'row', alignItems: 'center' },
  swText: { ...text(14, v4.white, 31), marginRight: 7 },
  sw: { width: 51, height: 31, borderRadius: 16, backgroundColor: v4.pill, justifyContent: 'center' },
  swOn: { backgroundColor: v4.accent },
  knob: { width: 27, height: 27, borderRadius: 13.5, backgroundColor: '#FFFFFF', marginLeft: 2 },
  knobOn: { marginLeft: 22 },
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: v4.white,
    backgroundColor: v4.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 5, marginRight: 10 },
  pillText: text(14, v4.white, 18),
});
