/** Small controls for design v2: segmented control, switch, outline button. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, IconName } from '../icons';
import { nocturne as N, qs, text } from '../theme';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  label,
}: {
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <View style={styles.seg} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            disabled={disabled}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!disabled }}
            style={({ pressed }) => [styles.segItem, on && styles.segOn, pressed && styles.pressed]}
          >
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Toggle = ({
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
  <Pressable
    onPress={() => onChange(!value)}
    disabled={disabled}
    hitSlop={9}
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityState={{ checked: value, disabled: !!disabled }}
    style={[styles.sw, value && styles.swOn]}
  >
    <View style={[styles.knob, value && styles.knobOn]} />
  </Pressable>
);

export const OutlineButton = ({
  icon,
  label,
  onPress,
  busy,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={busy}
    accessibilityRole="button"
    accessibilityState={{ busy: !!busy }}
    style={({ pressed }) => [styles.btn, (pressed || busy) && styles.btnPressed]}
  >
    <Icon name={icon} size={18} color={N.accent} />
    <Text style={styles.btnText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: N.line, borderRadius: N.radius.s, padding: 3 },
  segItem: { height: 36, paddingHorizontal: 14, borderRadius: 7, justifyContent: 'center', marginLeft: 2 },
  segOn: { backgroundColor: N.accentTint },
  segText: text(qs.semiBold, 14, N.ink2),
  segTextOn: { color: N.accent },
  pressed: { opacity: 0.8 },
  sw: { width: 44, height: 26, borderRadius: 13, backgroundColor: N.rail },
  swOn: { backgroundColor: N.accent },
  knob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: N.ink,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  knobOn: { left: 21, backgroundColor: N.knobOn },
  btn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: N.radius.s,
    borderWidth: 1,
    borderColor: N.accentLine,
    marginTop: 12,
  },
  btnPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  btnText: { ...text(qs.bold, 15, N.accent), marginLeft: 8 },
});
