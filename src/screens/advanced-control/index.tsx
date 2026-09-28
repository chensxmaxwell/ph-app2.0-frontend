/**
 * 高级控制 (Advanced control) — PLACEHOLDER SCREEN.
 *
 * Unstyled on purpose: design v1 was rejected; v2 visuals will replace this
 * file. All behaviour lives in `useAdvancedControl` / `controller.ts` /
 * `model.ts`, so v2 only needs to render `view` and call `ctl` intents.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenWrapper } from '@common/components/screen-wrapper';

import { RHYTHM_PRESETS } from './model';
import { useAdvancedControl } from './useAdvancedControl';

import type { CardView } from './controller';

const Btn = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    disabled={disabled}
    style={{ padding: 6, opacity: disabled ? 0.4 : 1 }}
  >
    <Text style={{ color: 'white' }}>[{label}]</Text>
  </Pressable>
);
const T = ({ children }: { children: React.ReactNode }) => <Text style={{ color: 'white' }}>{children}</Text>;
const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>{children}</View>
);

export const AdvancedControlScreen = () => {
  const { view, ctl } = useAdvancedControl();
  const { screen, banner, device } = view;

  const renderCard = (c: CardView, ghost: boolean) => (
    <View key={c.card.id} style={{ marginTop: 12, opacity: ghost || !c.enabled ? 0.5 : 1 }}>
      <Row>
        <Btn
          label={`${c.card.label} · ${c.summary}`}
          onPress={() => ctl.toggleCard(c.card.id)}
          disabled={ghost}
        />
        {c.kind === 'intensity' ? (
          <Btn label={c.on ? 'on' : 'off'} onPress={() => ctl.setWingOn(!c.on)} disabled={!c.enabled} />
        ) : null}
        {c.kind === 'rhythm' ? (
          <Btn label={c.on ? 'on' : 'off'} onPress={() => ctl.setPulseOn(!c.on)} disabled={!c.enabled} />
        ) : null}
      </Row>
      {c.expanded && c.kind === 'intensity' ? (
        <View>
          <Row>
            <Btn label="Steady" onPress={() => ctl.setWingMode('steady')} disabled={!c.enabled} />
            {c.rhythmAvailable
              ? RHYTHM_PRESETS.map(r => (
                  <Btn
                    key={r.id}
                    label={r.label}
                    onPress={() => ctl.setWingRhythm(r.id)}
                    disabled={!c.enabled}
                  />
                ))
              : null}
            <Btn label={c.link ? 'linked' : 'link'} onPress={() => ctl.toggleLink()} disabled={!c.enabled} />
          </Row>
          {c.card.groups.map(g => (
            <Row key={g.id}>
              <T>
                {g.id} · {g.name} ({g.detail}): {c.values[g.id]}
              </T>
              <Btn
                label="-10"
                onPress={() => ctl.setWingValue(g.id, c.values[g.id] - 10)}
                disabled={!c.enabled}
              />
              <Btn
                label="+10"
                onPress={() => ctl.setWingValue(g.id, c.values[g.id] + 10)}
                disabled={!c.enabled}
              />
            </Row>
          ))}
          <Row>
            <Btn label="-" onPress={() => ctl.stepFreq(-1)} disabled={!c.enabled} />
            <T>{c.freq} Hz</T>
            <Btn label="+" onPress={() => ctl.stepFreq(1)} disabled={!c.enabled} />
          </Row>
        </View>
      ) : null}
      {c.expanded && c.kind === 'rhythm' ? (
        <View>
          <Row>
            <Btn label="-2" onPress={() => ctl.setPulseHz(c.hz - 2)} disabled={!c.enabled} />
            <T>
              {c.hz} Hz ({c.card.range.min}–{c.card.range.max})
            </T>
            <Btn label="+2" onPress={() => ctl.setPulseHz(c.hz + 2)} disabled={!c.enabled} />
          </Row>
          <Row>
            <Btn
              label={`Soft ${c.presets.soft}`}
              onPress={() => ctl.setPulseHz(c.presets.soft, true)}
              disabled={!c.enabled}
            />
            <Btn
              label={`Medium ${c.presets.medium}`}
              onPress={() => ctl.setPulseHz(c.presets.medium, true)}
              disabled={!c.enabled}
            />
            <Btn
              label={`Strong ${c.presets.strong}`}
              onPress={() => ctl.setPulseHz(c.presets.strong, true)}
              disabled={!c.enabled}
            />
          </Row>
        </View>
      ) : null}
      {c.expanded && c.kind === 'sensor' ? (
        <T>
          Contact: {c.reading.contact ? 'yes' : 'no'} · HR: {c.reading.hr ?? '—'} · Actuator:{' '}
          {c.actuator === 'needs-hardware' ? '待硬件 (needs hardware)' : 'available'}
        </T>
      ) : null}
    </View>
  );

  return (
    <ScreenWrapper showCloseButton>
      <ScrollView>
        <T>Advanced control (placeholder — awaiting design v2)</T>
        <T>
          {device.connected
            ? `${device.name} · ${device.tempText} · ${device.batteryPct ?? '—'}%${
                device.vbat ? ` (${device.vbat.toFixed(2)} V)` : ''
              }`
            : `Not connected${device.lastName ? ` · Last: ${device.lastName}` : ''}`}
        </T>
        <T>State: {screen.kind}</T>
        {banner ? (
          <View style={{ marginTop: 8 }}>
            <T>{banner.title}</T>
            {banner.lines.map(l => (
              <T key={l}>{l}</T>
            ))}
          </View>
        ) : null}
        {view.toast ? <T>{view.toast}</T> : null}
        {screen.kind === 'disconnected' ? (
          <View style={{ marginTop: 8 }}>
            <Btn label={view.scan.connecting ? 'Searching…' : 'Scan for device'} onPress={() => ctl.scan()} />
            {view.scan.devices.map(d => (
              <Btn key={d.id} label={`${d.name} (${d.rssi})`} onPress={() => ctl.connect(d)} />
            ))}
            {view.lastSeen.length ? <T>LAST SEEN</T> : null}
            {view.lastSeen.map(c => renderCard(c, true))}
          </View>
        ) : (
          view.cards.map(c => renderCard(c, false))
        )}
        <View style={{ marginTop: 16 }}>
          {view.estop.on ? (
            <Pressable onPressIn={() => ctl.beginRelease()} onPressOut={() => ctl.cancelRelease()}>
              <T>[HOLD TO RELEASE {Math.round(view.estop.holdProgress * 100)}%]</T>
            </Pressable>
          ) : (
            <Btn label={view.stopQueued ? 'STOP ALL (queued)' : 'STOP ALL'} onPress={() => ctl.stopAll()} />
          )}
          <T>Leaving this page stops all outputs.</T>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};
