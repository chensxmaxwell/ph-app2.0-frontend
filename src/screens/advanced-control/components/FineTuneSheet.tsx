/**
 * Fine tune sheet content (design v2 Q5: FREQ lives in a collapsed secondary
 * panel). Rendered inside <OverlayHost> so Stop all stays on top (safety rule).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { nocturne as N, qs, text } from '../theme';

import { Slider } from './Slider';

export const FineTuneSheet = ({
  freq,
  range,
  def,
  onChange,
  onClose,
}: {
  freq: number;
  range: { min: number; max: number };
  def: number;
  onChange: (hz: number) => void;
  onClose: () => void;
}) => (
  <View>
    <View style={styles.grab} />
    <Text style={styles.title}>Fine tune</Text>
    <Text style={styles.p}>Vibration frequency, shared by upper and lower wings.</Text>
    <Slider
      label="Frequency"
      value={freq}
      min={range.min}
      max={range.max}
      step={5}
      unit=" Hz"
      ends={[`${range.min} Hz`, `${range.max} Hz`]}
      onChange={onChange}
    />
    <View style={styles.actions}>
      <Pressable onPress={() => onChange(def)} accessibilityRole="button" style={styles.ghost}>
        <Text style={styles.ghostText}>{`Reset to ${def} Hz`}</Text>
      </Pressable>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" style={styles.done}>
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  grab: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: N.rail,
    marginBottom: 14,
  },
  title: text(qs.bold, 19, N.ink, 22),
  p: { ...text(qs.medium, 14, N.ink2, 20), marginTop: 4, marginBottom: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 },
  ghost: { height: 44, justifyContent: 'center' },
  ghostText: text(qs.semiBold, 15, N.accent),
  done: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: N.radius.s,
    backgroundColor: N.accent,
    justifyContent: 'center',
  },
  doneText: text(qs.bold, 15, N.accentInk),
});
