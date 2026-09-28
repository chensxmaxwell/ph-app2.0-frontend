/**
 * Thin-rail slider (design v2 §6.4): label left, live value right (Outfit tnum),
 * 3 px rail, 21 px thumb, 44 px touch height. Streams values while dragging;
 * the client throttles to ~10 Hz / ≤ 20 cmd/s.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  AccessibilityActionEvent,
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { nocturne as N, num, qs, text } from '../theme';

export interface SliderProps {
  label: string;
  sub?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  ends?: [string, string];
  disabled?: boolean;
  /** Dashed rail, no thumb: control not available on this hardware. */
  unavailable?: string;
  first?: boolean;
  onChange?: (v: number) => void;
  onRelease?: (v: number) => void;
  testID?: string;
}

export const Slider = ({
  label,
  sub,
  value,
  min,
  max,
  step = 1,
  unit,
  ends,
  disabled,
  unavailable,
  first,
  onChange,
  onRelease,
  testID,
}: SliderProps) => {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const live = useRef({ width, min, max, step, disabled, onChange, onRelease, last: value });
  live.current = { ...live.current, width, min, max, step, disabled, onChange, onRelease };

  const valueAt = (x: number) => {
    const c = live.current;
    const p = c.width > 0 ? Math.max(0, Math.min(1, x / c.width)) : 0;
    const raw = c.min + p * (c.max - c.min);
    return Math.max(c.min, Math.min(c.max, Math.round(raw / c.step) * c.step));
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.disabled,
        onMoveShouldSetPanResponder: () => !live.current.disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const v = valueAt(e.nativeEvent.locationX);
          live.current.last = v;
          setDrag(v);
          live.current.onChange?.(v);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const v = valueAt(e.nativeEvent.locationX);
          if (v !== live.current.last) {
            live.current.last = v;
            setDrag(v);
            live.current.onChange?.(v);
          }
        },
        onPanResponderRelease: () => {
          live.current.onRelease?.(live.current.last);
          setDrag(null);
        },
        onPanResponderTerminate: () => setDrag(null),
      }),

    [],
  );

  const shown = drag ?? value;
  const pct = max > min ? (Math.max(min, Math.min(max, shown)) - min) / (max - min) : 0;
  const x = pct * width;

  const onA11y = (e: AccessibilityActionEvent) => {
    const d =
      e.nativeEvent.actionName === 'increment' ? step : e.nativeEvent.actionName === 'decrement' ? -step : 0;
    if (d && !disabled) {
      const v = Math.max(min, Math.min(max, shown + d * Math.max(1, Math.round((max - min) / step / 20))));
      onChange?.(v);
      onRelease?.(v);
    }
  };

  return (
    <View style={first ? styles.first : styles.wrap} testID={testID}>
      <View style={styles.row}>
        <Text style={styles.label}>
          {label}
          {sub ? <Text style={styles.sub}>{`  ${sub}`}</Text> : null}
        </Text>
        {unavailable ? (
          <Text style={styles.tag}>{unavailable}</Text>
        ) : (
          <Text style={num(22)}>
            {shown}
            {unit ? <Text style={styles.unit}>{unit}</Text> : null}
          </Text>
        )}
      </View>
      <View
        style={styles.track}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        accessible={!unavailable}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: shown, text: `${shown}${unit ?? ''}` }}
        accessibilityState={{ disabled: !!disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onA11y}
        {...(unavailable ? {} : pan.panHandlers)}
      >
        {unavailable ? (
          <View style={styles.dashes} pointerEvents="none">
            {Array.from({ length: Math.max(0, Math.floor(width / 10)) }, (_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>
        ) : (
          <>
            <View style={styles.rail} pointerEvents="none" />
            <View style={[styles.fill, { width: x }]} pointerEvents="none" />
            {width > 0 ? <View style={[styles.thumb, { left: x - 10.5 }]} pointerEvents="none" /> : null}
          </>
        )}
      </View>
      {ends ? (
        <View style={styles.ends}>
          <Text style={styles.endText}>{ends[0]}</Text>
          <Text style={styles.endText}>{ends[1]}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  first: { marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: text(qs.semiBold, 15, N.ink, 18),
  sub: text(qs.medium, 13, N.ink3),
  unit: { fontSize: 14, color: N.ink2 },
  tag: text(qs.semiBold, 13, N.ink3),
  track: { height: 44, marginVertical: -4, justifyContent: 'center' },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 21,
    height: 3,
    borderRadius: 2,
    backgroundColor: N.rail,
  },
  fill: { position: 'absolute', left: 0, top: 21, height: 3, borderRadius: 2, backgroundColor: N.accent },
  thumb: {
    position: 'absolute',
    top: 12,
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: N.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dashes: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 21,
    height: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dash: { width: 6, height: 3, marginRight: 4, backgroundColor: N.rail },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 },
  endText: text(qs.medium, 13, N.ink3, 15),
});
