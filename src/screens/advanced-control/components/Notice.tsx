/**
 * Notice card (design v4 §1, §5): the module-card surface, first in the stack.
 * Icon 32 + title 14 + one body line 13 (all full white, no grey on cards), optional
 * PillButton-style action on the right (Reconnect / Scan). Used for e-stop,
 * connection lost, over-temp, low battery and short info messages.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, StopCircle } from '../icons';
import { BannerModel } from '../model';
import { text, v4 } from '../theme';

const ICON: Record<BannerModel['icon'], React.ReactNode> = {
  lock: <StopCircle size={32} color={v4.white} />,
  bluetooth: <Icon name="bluetooth-slash" size={30} color={v4.white} />,
  thermometer: <Icon name="thermometer-simple" size={30} color={v4.white} />,
  battery: <Icon name="battery-low" size={30} color={v4.white} />,
  info: <Icon name="info" size={30} color={v4.white} />,
};

export const Notice = ({
  model,
  busy,
  onAction,
}: {
  model: BannerModel;
  busy?: boolean;
  onAction?: (a: NonNullable<BannerModel['action']>) => void;
}) => {
  const label = model.action === 'reconnect' ? 'Reconnect' : 'Scan';
  return (
    <View
      style={styles.card}
      testID="notice"
      accessible={!model.action}
      accessibilityRole={model.action ? undefined : 'alert'}
      accessibilityLabel={model.action ? undefined : `${model.title}. ${model.line}`}
    >
      <View style={styles.icon}>{ICON[model.icon]}</View>
      <View style={styles.texts}>
        {/* Exactly two lines: title + one body line (design review 2026-10-04). */}
        <Text style={styles.title} numberOfLines={1} testID="notice-title">
          {model.title}
        </Text>
        <Text style={styles.body} numberOfLines={1} testID="notice-line">
          {model.line}
        </Text>
      </View>
      {model.action ? (
        <Pressable
          onPress={() => onAction?.(model.action!)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ busy: !!busy, disabled: !!busy }}
          style={({ pressed }) => [styles.btn, (pressed || busy) && styles.pressed]}
        >
          <Text style={styles.btnText}>{busy ? 'Connecting…' : label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: v4.card,
    borderRadius: v4.radius,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  texts: { flex: 1 },
  title: text(14, v4.white, 18),
  body: { ...text(13, v4.white, 17), marginTop: 3 },
  btn: {
    marginLeft: 12,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: v4.white,
    backgroundColor: v4.pill,
    justifyContent: 'center',
  },
  btnText: text(14),
  pressed: { opacity: 0.7 },
});
