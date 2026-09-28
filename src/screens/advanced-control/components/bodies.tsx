/** Expanded row bodies (design v2 §6.4-6.8). App copy only, never INFO labels (Q10). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RHYTHM_PRESETS, RhythmPresetId } from '../model';
import { nocturne as N, num, qs, text } from '../theme';

import { Slider } from './Slider';
import { Segmented, Toggle } from './controls';

import type { AdvancedControlController, IntensityView, RhythmView, SensorView } from '../controller';

const PATTERN = [
  { id: 'steady', label: 'Steady' },
  { id: 'rhythm', label: 'Beat' },
] as const;
/** Q6: presets only, no raw ms (Slow 800/800, Medium 400/400, Fast 150/150). */
const BEAT = RHYTHM_PRESETS.map(r => ({ id: r.id, label: r.label }));

export const WingsBody = ({ v, ctl }: { v: IntensityView; ctl: AdvancedControlController }) => (
  <View>
    {v.card.groups.map((g, i) => (
      <Slider
        key={g.id}
        first={i === 0}
        label={g.name}
        sub={g.id}
        value={v.values[g.id]}
        min={0}
        max={100}
        unit="%"
        disabled={!v.enabled}
        onChange={x => ctl.setWingValue(g.id, x)}
        testID={`wing-${g.zone}`}
      />
    ))}
    {v.rhythmAvailable ? (
      <>
        <View style={styles.line}>
          <Text style={styles.k}>Pattern</Text>
          <Segmented
            label="Pattern"
            options={PATTERN}
            value={v.mode}
            disabled={!v.enabled}
            onChange={m => ctl.setWingMode(m)}
          />
        </View>
        {v.mode === 'rhythm' ? (
          <View style={styles.line}>
            <Text style={styles.k}>Speed</Text>
            <Segmented<RhythmPresetId>
              label="Beat speed"
              options={BEAT}
              value={v.rhythm}
              disabled={!v.enabled}
              onChange={r => ctl.setWingRhythm(r)}
            />
          </View>
        ) : null}
      </>
    ) : null}
  </View>
);

export const PulseBody = ({ v, ctl }: { v: RhythmView; ctl: AdvancedControlController }) => (
  <View>
    <View style={[styles.line, styles.lineFirst]}>
      <Text style={styles.k}>Output</Text>
      <Toggle label="Pulse output" value={v.on} disabled={!v.enabled} onChange={on => ctl.setPulseOn(on)} />
    </View>
    <Slider
      label="Rhythm"
      value={v.hz}
      min={v.card.range.min}
      max={v.card.range.max}
      unit=" Hz"
      ends={['Soft', 'Strong']}
      disabled={!v.enabled}
      onChange={hz => ctl.setPulseHz(hz)}
      testID="pulse-rhythm"
    />
    <Text style={styles.note}>{`Range from device, ${v.card.range.min}-${v.card.range.max} Hz`}</Text>
  </View>
);

export const BulletBody = ({ v }: { v: SensorView }) => {
  const r = v.reading;
  return (
    <View>
      <View style={styles.reads}>
        <View style={styles.rd}>
          <Text style={styles.rk}>Contact</Text>
          <Text style={styles.rw}>{!r.available ? 'No data' : r.contact ? 'On skin' : 'Not on skin'}</Text>
        </View>
        <View style={styles.rd}>
          <Text style={styles.rk}>Heart rate</Text>
          {r.available && r.contact && r.hr ? (
            <Text style={[num(30), styles.rn]}>
              {r.hr}
              <Text style={styles.ru}>{' bpm'}</Text>
            </Text>
          ) : (
            <Text style={styles.rw}>{r.available && r.contact ? 'Measuring' : 'n/a'}</Text>
          )}
        </View>
      </View>
      {v.actuator === 'needs-hardware' ? (
        <Slider label="Vibration" value={0} min={0} max={100} unavailable="Needs hardware" disabled />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  lineFirst: { marginTop: 2 },
  k: text(qs.semiBold, 15, N.ink, 18),
  note: { ...text(qs.medium, 13, N.ink3), marginTop: 8 },
  reads: { flexDirection: 'row', marginTop: 4 },
  rd: { flex: 1 },
  rk: text(qs.semiBold, 14, N.ink2, 17),
  rw: { ...text(qs.bold, 19, N.ink, 25), marginTop: 8 },
  rn: { marginTop: 6 },
  ru: { fontSize: 15, color: N.ink2 },
});
