/** Borderless notice (design v2 §6.9): 22 icon + bold line + body, hairline above. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, IconName } from '../icons';
import { nocturne as N, qs, text } from '../theme';

import { OutlineButton } from './controls';

import type { BannerModel } from '../model';

const ICON: Record<BannerModel['icon'], IconName> = {
  lock: 'lock-simple',
  thermometer: 'thermometer-simple',
  battery: 'battery-low',
  bluetooth: 'bluetooth-slash',
  info: 'info',
};

export const Notice = ({
  model,
  onAction,
  busy,
}: {
  model: BannerModel;
  onAction?: (a: NonNullable<BannerModel['action']>) => void;
  busy?: boolean;
}) => {
  const warn = model.tone === 'warn';
  return (
    <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.icon}>
        <Icon name={ICON[model.icon]} size={22} color={warn ? N.warn : N.ink} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, warn && styles.warn]}>{model.title}</Text>
        {model.lines.length ? <Text style={styles.p}>{model.lines.join(' ')}</Text> : null}
        {model.action && onAction ? (
          <OutlineButton
            icon="arrows-clockwise"
            label={
              busy
                ? model.action === 'reconnect'
                  ? 'Reconnecting'
                  : 'Searching'
                : model.action === 'reconnect'
                ? 'Reconnect'
                : 'Scan'
            }
            busy={busy}
            onPress={() => onAction(model.action!)}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: N.pad,
    borderTopWidth: 1,
    borderTopColor: N.line,
  },
  icon: { marginTop: 1, marginRight: 12 },
  body: { flex: 1 },
  title: text(qs.bold, 16, N.ink, 21),
  warn: { color: N.warn },
  p: { ...text(qs.medium, 14, N.ink2, 20), marginTop: 4 },
});
