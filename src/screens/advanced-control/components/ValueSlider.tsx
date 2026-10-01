/**
 * Slider (design v4 §1, §2, §5): label 13 left + fixed 78x28 value box right
 * (right-aligned, so digits never shift the layout), then the App SeekBar look
 * at 32 pt: track grayLightest, fill #8C60B2 -> #CCA0DD, white thumb 24.
 * While dragging the thumb grows to 34 with a 3 px accent ring and the value
 * box fills accent with ink digits. Streams values while dragging; the client
 * throttles to ~10 Hz / <= 20 cmd/s and the release sends the final value.
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
import Gradient from 'react-native-linear-gradient';

import { text, v4 } from '../theme';

export const TRACK_H = 32;
const THUMB = 24;
const THUMB_ON = 34;
const RING = 3;

/** Thumb centre / fill width for a value (pure; unit-tested). */
export function sliderGeometry(value: number, min: number, max: number, width: number) {
  const p = max > min ? (Math.max(min, Math.min(max, value)) - min) / (max - min) : 0;
  const cx = TRACK_H / 2 + p * Math.max(0, width - TRACK_H);
  return { p, cx, fill: p > 0 ? cx + TRACK_H / 2 : 0 };
}

/** Value under a touch x (inverse of the thumb travel), snapped to step. */
export function valueAtX(x: number, min: number, max: number, step: number, width: number): number {
  const travel = Math.max(1, width - TRACK_H);
  const p = Math.max(0, Math.min(1, (x - TRACK_H / 2) / travel));
  return Math.max(min, Math.min(max, Math.round((min + p * (max - min)) / step) * step));
}

export const ValueBox = ({ value, unit, active }: { value: number; unit: string; active: boolean }) => (
  <View style={[styles.box, active && styles.boxOn]} testID={active ? 'value-box-active' : 'value-box'}>
    <Text style={[styles.num, active && styles.numOn]} numberOfLines={1}>
      {value}
      <Text style={[styles.unit, active && styles.numOn]}>{unit}</Text>
    </Text>
  </View>
);

export interface ValueSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  disabled?: boolean;
  /** Output off (Pulse): track and thumb only, no fill; the value stays shown. */
  idle?: boolean;
  first?: boolean;
  onChange?: (v: number) => void;
  onRelease?: (v: number) => void;
  onDragChange?: (dragging: boolean) => void;
  testID?: string;
}

export const ValueSlider = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  disabled,
  idle,
  first,
  onChange,
  onRelease,
  onDragChange,
  testID,
}: ValueSliderProps) => {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const live = useRef({ width, min, max, step, disabled, onChange, onRelease, onDragChange, last: value });
  live.current = { ...live.current, width, min, max, step, disabled, onChange, onRelease, onDragChange };

  const pan = useMemo(() => {
    const at = (e: GestureResponderEvent) => {
      const c = live.current;
      return valueAtX(e.nativeEvent.locationX, c.min, c.max, c.step, c.width);
    };
    const end = () => {
      setDrag(null);
      live.current.onDragChange?.(false);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.disabled,
      onMoveShouldSetPanResponder: () => !live.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        const v = at(e);
        live.current.last = v;
        setDrag(v);
        live.current.onDragChange?.(true);
        live.current.onChange?.(v);
      },
      onPanResponderMove: e => {
        const v = at(e);
        if (v !== live.current.last) {
          live.current.last = v;
          setDrag(v);
          live.current.onChange?.(v);
        }
      },
      onPanResponderRelease: () => {
        live.current.onRelease?.(live.current.last);
        end();
      },
      onPanResponderTerminate: end,
    });
  }, []);

  const shown = drag ?? value;
  const active = drag !== null;
  const g = sliderGeometry(shown, min, max, width);
  const size = active ? THUMB_ON : THUMB;

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
    <View style={first ? styles.first : styles.next} testID={testID}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <ValueBox value={shown} unit={unit} active={active} />
      </View>
      <View
        style={styles.track}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: shown, text: `${shown}${unit.trim()}` }}
        accessibilityState={{ disabled: !!disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onA11y}
        {...pan.panHandlers}
      >
        {!idle && g.fill > 0 ? (
          <Gradient
            colors={[v4.accentDeep, v4.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: g.fill }]}
            pointerEvents="none"
          />
        ) : null}
        {width > 0 ? (
          <View
            pointerEvents="none"
            testID={active ? 'thumb-active' : 'thumb'}
            style={[
              styles.thumb,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                left: g.cx - size / 2,
                top: (TRACK_H - size) / 2,
              },
              active && styles.thumbOn,
            ]}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  first: { marginTop: 12 },
  next: { marginTop: 14 },
  row: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: text(13, v4.white, 17),
  box: {
    width: 78,
    height: 28,
    borderRadius: 14,
    paddingRight: 9,
    marginRight: -9,
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: v4.accent },
  num: { ...text(20, v4.white, 28), textAlign: 'right' },
  unit: { fontSize: 14 },
  numOn: { color: v4.ink },
  track: { height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: v4.pill },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: TRACK_H / 2 },
  /** App RadialButton without its glow: radial #FFFFFF -> #FFF0F2 (flat mid tone here). */
  thumb: { position: 'absolute', backgroundColor: '#FFF7F9' },
  thumbOn: { borderWidth: RING, borderColor: v4.accent },
});
