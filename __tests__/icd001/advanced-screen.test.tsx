/**
 * Design v4 screen on the simulator: cards (Wings / Pulse / Bullet) with live
 * values, slider + switch commands, Stop all -> Stopped + Unlock (values 0),
 * link loss (dimmed controls, Stop all still pressable and queued as ESTOP 1
 * first on reconnect), and STOP on leave. Also the Control-home entry row
 * (visible only while ICD1-/H11- connected) and the slider geometry.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-ble-manager', () => ({}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => undefined,
  useRoute: () => ({ name: 'AdvancedControl', params: undefined }),
  useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-linear-gradient', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View };
});
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View, Path: View };
});

import { AdvancedControlScreen } from '../../src/screens/advanced-control';
import {
  ValueSlider,
  sliderGeometry,
  valueAtX,
} from '../../src/screens/advanced-control/components/ValueSlider';
import { AdvancedEntry, isAdvancedDevice } from '../../src/screens/control/advanced-entry';
import { getIcd001Client, setIcd001Mode } from '../../src/services/icd001/useIcd001';

const flat = (c: unknown): string =>
  Array.isArray(c) ? c.map(flat).join('') : typeof c === 'string' || typeof c === 'number' ? String(c) : '';
const texts = (r: renderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => flat(n.props.children))
    .join('\n');
const byLabel = (r: renderer.ReactTestRenderer, label: string | RegExp) =>
  r.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      (typeof label === 'string'
        ? n.props.accessibilityLabel === label
        : label.test(n.props.accessibilityLabel)),
  )[0];
const byTestID = (r: renderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id);
const opacityOf = (style: unknown): number => {
  const list = (Array.isArray(style) ? style.flat(5) : [style]) as Array<{ opacity?: number } | null | false>;
  return list.reduce((o, s) => (s && typeof s.opacity === 'number' ? s.opacity : o), 1);
};
const fontsOf = (r: renderer.ReactTestRenderer) =>
  new Set(
    r.root
      .findAll(n => (n.type as unknown) === 'Text')
      .map(n => {
        const list = (Array.isArray(n.props.style) ? n.props.style.flat(5) : [n.props.style]) as Array<{
          fontFamily?: string;
        } | null>;
        return list.reduce<string | undefined>(
          (f, st) => (st && st.fontFamily ? st.fontFamily : f),
          undefined,
        );
      }),
  );
/** Text inside the Wings and Pulse cards (control rows): must carry no numbers / units. */
const controlRowText = (r: renderer.ReactTestRenderer) =>
  ['card-wing', 'card-vcm']
    .flatMap(id => r.root.findAll(n => n.props.testID === id).slice(0, 1))
    .flatMap(c => c.findAll(n => (n.type as unknown) === 'Text').map(n => flat(n.props.children)))
    .join('\n');
const settle = async (ms = 1000) => {
  for (let i = 0; i < ms / 10; i++) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

describe('isAdvancedDevice / slider geometry', () => {
  it('shows the entry only for a connected ICD1- / H11- device', () => {
    expect(isAdvancedDevice('connected', 'ICD1-91B1')).toBe(true);
    expect(isAdvancedDevice('connected', 'H11-0001')).toBe(true);
    expect(isAdvancedDevice('connected', 'Other')).toBe(false);
    expect(isAdvancedDevice('connecting', 'ICD1-91B1')).toBe(false);
    expect(isAdvancedDevice('connected', null)).toBe(false);
  });
  it('places the thumb centre and fill like design v4 (cx = 16 + p(W-32), fill = cx + 16)', () => {
    expect(sliderGeometry(0, 0, 100, 310)).toMatchObject({ p: 0, cx: 16 });
    expect(sliderGeometry(100, 0, 100, 310)).toMatchObject({ p: 1, cx: 294, fill: 310 });
    expect(sliderGeometry(40, 0, 100, 310)).toMatchObject({ cx: 16 + 0.4 * 278 });
    expect(sliderGeometry(30, 10, 50, 310).p).toBeCloseTo(0.5);
    expect(valueAtX(16, 0, 100, 1, 310)).toBe(0);
    expect(valueAtX(294, 0, 100, 1, 310)).toBe(100);
    expect(valueAtX(155, 10, 50, 1, 310)).toBe(30);
    expect(valueAtX(-50, 10, 50, 1, 310)).toBe(10);
  });
  it('slider draws only its label: no number, no unit', () => {
    const r = renderer.create(<ValueSlider label="Upper wings" value={40} min={0} max={100} unit="%" />);
    expect(texts(r)).toBe('Upper wings');
    expect(byTestID(r, 'value-box').length + byTestID(r, 'value-box-active').length).toBe(0);
    // the value is still there for screen readers
    expect(
      r.root.find(n => n.props.accessibilityRole === 'adjustable').props.accessibilityValue,
    ).toMatchObject({
      now: 40,
      text: '40%',
    });
  });
});

describe('AdvancedControlScreen v4 on the mock', () => {
  beforeAll(async () => {
    jest.useFakeTimers({ now: 11_000_000 });
    await setIcd001Mode('mock');
  });
  afterAll(() => {
    getIcd001Client().destroy();
    jest.useRealTimers();
  });

  it('walks disconnected -> cards -> slider/switch -> Stop all/Unlock -> link loss queue -> leave', async () => {
    let r!: renderer.ReactTestRenderer;
    let entry!: renderer.ReactTestRenderer;
    await act(async () => {
      r = renderer.create(<AdvancedControlScreen />);
      entry = renderer.create(<AdvancedEntry />);
    });
    expect(texts(r)).toContain('Not connected');
    expect(texts(r)).toContain('Advanced control');
    expect(entry.toJSON()).toBeNull();

    const client = getIcd001Client();
    const transport = (client as unknown as { transport: any }).transport;
    await act(async () => {
      const p = client.connect({
        id: 'sim-ICD1-5A3C',
        name: 'ICD1-5A3C',
        rssi: -50,
        kind: null,
        simulated: true,
      });
      await settle();
      await p;
    });
    const dev = transport.devices.get('sim-ICD1-5A3C');
    let t = texts(r);
    for (const s of ['Connected', 'Wings', 'Upper wings', 'Lower wings', 'Pulse', 'Pulse speed', 'Bullet']) {
      expect(t).toContain(s);
    }
    // Sliders only: no number, %, or Hz in the Wings / Pulse cards (control values).
    expect(controlRowText(r)).toContain('Upper wings');
    expect(controlRowText(r)).not.toMatch(/\d|%|Hz/);
    expect(t).not.toMatch(/\bHz\b/);
    expect(t).not.toContain('Not connected');
    expect(t).not.toContain('Fine tune'); // 170 Hz fixed, no frequency UI
    expect(t).not.toContain('Leaving this page stops all outputs.');
    // App type system only: Quicksand-Bold everywhere, no Outfit numerals.
    expect([...fontsOf(r)]).toEqual(['Quicksand-Bold']);
    expect(opacityOf(byTestID(r, 'controls-wing')[0].props.style)).toBe(1);
    expect(byTestID(entry, 'advanced-entry').length).toBeGreaterThan(0);
    expect(texts(entry)).toContain('Each part on its own');
    expect([...fontsOf(entry)]).toEqual(['Quicksand-Bold']);
    const detail = entry.root.find(
      n => (n.type as unknown) === 'Text' && n.props.children === 'Each part on its own',
    );
    expect(JSON.stringify(detail.props.style)).toContain('rgba(243, 243, 243, 0.6)');

    // Upper wings through the a11y increment -> LRA A; pulse switch -> VHZ.
    const upper = r.root.find(
      n => n.props.accessibilityLabel === 'Upper wings' && n.props.onAccessibilityAction,
    );
    await act(async () => {
      upper.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
      await settle(300);
    });
    expect(dev.commandLog.some((l: string) => /^LRA 0 [1-9]/.test(l))).toBe(true);
    await act(async () => {
      r.root.find(n => n.props.testID === 'pulse-switch' && n.props.onPress).props.onPress();
      await settle(300);
    });
    expect(dev.commandLog.some((l: string) => /^VHZ [1-9]/.test(l))).toBe(true);
    expect(controlRowText(r)).not.toMatch(/\d|%|Hz/); // pulse on: still no speed readout
    expect(
      r.root.find(n => n.props.testID === 'pulse-switch' && n.props.onPress).props.accessibilityState,
    ).toMatchObject({ checked: true });

    // Stop all -> ESTOP 1, notice + "Stopped" + Unlock, values at 0.
    dev.commandLog.length = 0;
    await act(async () => {
      byLabel(r, 'Stop all outputs').props.onPress();
      await settle(500);
    });
    expect(dev.commandLog).toContain('ESTOP 1');
    t = texts(r);
    expect(t).toContain('Everything is stopped');
    expect(t).toContain('All outputs are off.');
    expect(controlRowText(r)).not.toMatch(/\d|%|Hz/);
    expect(t).toContain('Stopped');
    expect(byTestID(r, 'stop-all').length).toBe(0);
    expect(
      r.root.find(n => n.props.accessibilityLabel === 'Upper wings' && n.props.onAccessibilityAction).props
        .accessibilityValue,
    ).toMatchObject({ now: 0 });
    expect(opacityOf(byTestID(r, 'controls-wing')[0].props.style)).toBe(0.4);
    // Unlock -> ESTOP 0; everything stays at 0, Stop all is back.
    dev.commandLog.length = 0;
    await act(async () => {
      byLabel(r, 'Unlock').props.onPress();
      await settle(500);
    });
    expect(dev.commandLog).toContain('ESTOP 0');
    expect(dev.commandLog.filter((l: string) => /^(LRA [01] [1-9]|VHZ [1-9])/.test(l))).toEqual([]);
    expect(texts(r)).not.toContain('Everything is stopped');
    expect(byTestID(r, 'stop-all').length).toBeGreaterThan(0);
    expect(
      r.root.find(n => n.props.accessibilityLabel === 'Upper wings' && n.props.onAccessibilityAction).props
        .accessibilityValue,
    ).toMatchObject({ now: 0 });

    // Link loss -> "Connection lost" + Reconnect, controls dimmed, Stop all still pressable.
    await act(async () => {
      transport.simulateLinkLoss('sim-ICD1-5A3C');
      await settle(20);
    });
    t = texts(r);
    expect(t).toContain('Connection lost');
    expect(t).toMatch(/Reconnect|Connecting…/); // notice button (busy while the auto-reconnect runs)
    expect(t).toMatch(/Disconnected|Connecting…/);
    expect(t).toContain('No signal');
    expect(controlRowText(r)).not.toMatch(/\d|%|Hz/);
    expect(opacityOf(byTestID(r, 'controls-wing')[0].props.style)).toBe(0.4);
    expect(opacityOf(byTestID(r, 'controls-vcm')[0].props.style)).toBe(0.4);
    const stop = byLabel(r, 'Stop all outputs');
    expect(stop).toBeTruthy();
    dev.commandLog.length = 0;
    await act(async () => {
      stop.props.onPress();
      await settle(20);
    });
    expect(texts(r)).toContain('Stays stopped after reconnect.');
    // Auto-reconnect: ESTOP 1 is the first command on the new link -> Stopped.
    await act(async () => {
      await settle(1500);
    });
    expect(dev.commandLog[0]).toBe('ESTOP 1');
    t = texts(r);
    expect(t).toContain('Everything is stopped');
    expect(t).toContain('Unlock');

    const sent: string[] = [];
    const unsub = client.subscribe(s => {
      const last = s.log[s.log.length - 1];
      if (last) {
        sent.push(last);
      }
    });
    await act(async () => {
      r.unmount();
      entry.unmount();
      await jest.advanceTimersByTimeAsync(50);
    });
    unsub();
    expect(sent.some(l => l.includes('STOP'))).toBe(true);
  });
});
