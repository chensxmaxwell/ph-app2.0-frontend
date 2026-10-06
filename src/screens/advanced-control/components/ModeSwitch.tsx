/**
 * Auto | Manual segmented control (ICD001-1 only, PROTOCOL §11.4–§11.6),
 * under the connection pill. Reflects the device mode (Auto after connect,
 * §11.5.1). Manual = explicit takeover (`MODE MANUAL`, sliders unlock);
 * Auto = hand back (`MODE AUTO`). While a switch is in flight the target is
 * shown at reduced opacity. Auto is disabled while latched (§11.4.10).
 * App style: grayLightest pill with 1 px white border (ConnectionPill look),
 * selected segment filled with the SeekBar gradient (#8C60B2 -> accent), Quicksand-Bold.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Gradient from 'react-native-linear-gradient';

import { text, v4 } from '../theme';

import type { DeviceMode } from '../../../services/icd001/protocol';

export const ModeSwitch = ({
  current,
  switching,
  autoAllowed,
  onChange,
}: {
  current: DeviceMode | null;
  switching: boolean;
  autoAllowed: boolean;
  onChange: (m: DeviceMode) => void;
}) => {
  const seg = (m: DeviceMode, label: string) => {
    const on = current === m;
    const disabled = (m === 'auto' && !autoAllowed) || on;
    return (
      <Pressable
        key={m}
        onPress={() => onChange(m)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: on, disabled: m === 'auto' && !autoAllowed, busy: on && switching }}
        style={[styles.seg, m === 'auto' && !autoAllowed && !on && styles.dim]}
        testID={`mode-${m}`}
      >
        {on ? (
          <Gradient
            colors={[v4.accentDeep, v4.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, styles.fill, switching && styles.pending]}
            pointerEvents="none"
          />
        ) : null}
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.track} testID="mode-switch" accessibilityRole="tablist">
      {seg('auto', 'Auto')}
      {seg('manual', 'Manual')}
    </View>
  );
};

const H = 40;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    width: 220,
    height: H,
    padding: 3,
    borderRadius: H / 2,
    borderWidth: 1,
    borderColor: v4.white,
    backgroundColor: v4.pill,
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: (H - 6) / 2,
    overflow: 'hidden',
  },
  fill: { borderRadius: (H - 6) / 2 },
  pending: { opacity: 0.55 },
  label: text(14, v4.white, 18),
  dim: { opacity: v4.dimOpacity },
});
