/** Module row (design v2 §6.3): typographic row, hairline above, caret; no cards. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../icons';
import { nocturne as N, num, qs, text } from '../theme';

import type { RowValue } from '../controller';

export const RowValueText = ({ v }: { v: RowValue }) => {
  switch (v.kind) {
    case 'off':
      return <Text style={styles.off}>{v.text}</Text>;
    case 'text':
      return <Text style={styles.word}>{v.text}</Text>;
    case 'ab':
      return (
        <View style={styles.ab}>
          <Text style={num(21)}>
            <Text style={styles.small}>{'A '}</Text>
            {v.A}
          </Text>
          <Text style={[num(21), styles.abGap]}>
            <Text style={styles.small}>{'B '}</Text>
            {v.B}
          </Text>
        </View>
      );
    case 'hz':
      return (
        <Text style={num(21)}>
          {v.hz}
          <Text style={styles.unit}>{' Hz'}</Text>
        </Text>
      );
    case 'bpm':
      return (
        <Text style={num(21)}>
          {v.bpm}
          <Text style={styles.unit}>{' bpm'}</Text>
        </Text>
      );
  }
};

const a11yValue = (v: RowValue): string => {
  switch (v.kind) {
    case 'off':
    case 'text':
      return v.text;
    case 'ab':
      return `Upper ${v.A} percent, lower ${v.B} percent`;
    case 'hz':
      return `${v.hz} hertz`;
    case 'bpm':
      return `${v.bpm} beats per minute`;
  }
};

export const ModuleRow = ({
  title,
  subtitle,
  value,
  expanded,
  dimmed,
  onToggle,
  children,
  testID,
}: {
  title: string;
  subtitle: string;
  value: RowValue;
  expanded: boolean;
  dimmed?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  testID?: string;
}) => (
  <View style={[styles.mod, dimmed && styles.dimmed]} testID={testID}>
    <Pressable
      onPress={onToggle}
      disabled={!onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}. ${a11yValue(value)}`}
      accessibilityState={{ expanded, disabled: !onToggle }}
      style={({ pressed }) => [styles.hd, pressed && styles.pressed]}
    >
      <View style={styles.titles}>
        <Text style={styles.t}>{title}</Text>
        <Text style={styles.s}>{subtitle}</Text>
      </View>
      {expanded ? null : <RowValueText v={value} />}
      <View style={styles.car}>
        <Icon name={expanded ? 'caret-up' : 'caret-down'} size={20} color={expanded ? N.ink : N.ink3} />
      </View>
    </Pressable>
    {expanded ? <View style={styles.bd}>{children}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  mod: { borderTopWidth: 1, borderTopColor: N.line },
  dimmed: { opacity: N.disabledOpacity },
  hd: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: N.pad,
    minHeight: 72,
  },
  pressed: { backgroundColor: 'rgba(243,238,240,0.03)' },
  titles: { flex: 1, marginRight: 12 },
  t: text(qs.bold, 19, N.ink, 22),
  s: { ...text(qs.medium, 14, N.ink2, 17), marginTop: 4 },
  bd: { paddingHorizontal: N.pad, paddingTop: 2, paddingBottom: 20 },
  car: { width: 24, alignItems: 'flex-end', marginLeft: 12 },
  off: text(qs.semiBold, 15, N.ink3),
  word: text(qs.bold, 17, N.ink),
  ab: { flexDirection: 'row', alignItems: 'flex-end' },
  abGap: { marginLeft: 14 },
  small: { fontFamily: qs.semiBold, fontSize: 13, color: N.ink3 },
  unit: { fontSize: 14, color: N.ink2 },
});
