/**
 * Manual page UI for ICD001-1 auto / manual (§11.4–§11.6) on the simulator:
 * Auto | Manual control under the connection pill (Auto after connect),
 * read-only cards in Auto (a touch only hints), explicit takeover, sensors row
 * and Re-zero pressure only in Auto, no numbers / Hz on the controls, the
 * global "Auto on" pill, and old firmware (ICD001-0 / H11) without the control.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-ble-manager', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => undefined,
  useRoute: () => ({ name: 'Manual', params: undefined }),
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
import { AutoPill } from '../../src/screens/advanced-control/components/AutoPill';
import { getIcd001Client, setControlPageFocused, setIcd001Mode } from '../../src/services/icd001/useIcd001';

const flat = (c: unknown): string =>
  Array.isArray(c) ? c.map(flat).join('') : typeof c === 'string' || typeof c === 'number' ? String(c) : '';
const textsOf = (root: renderer.ReactTestInstance) =>
  root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => flat(n.props.children))
    .join('\n');
const byTestID = (r: renderer.ReactTestRenderer, id: string) =>
  r.root.findAll(n => n.props.testID === id && typeof n.type !== 'string');
const has = (r: renderer.ReactTestRenderer, id: string) => byTestID(r, id).length > 0;
const lastCmd = (log: string[]) => log.filter(c => c !== 'PING').slice(-1)[0];
const settle = async (ms = 1000) => {
  for (let i = 0; i < ms / 10; i++) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

describe('Manual page, ICD001-1 Auto | Manual (mock)', () => {
  beforeAll(async () => {
    jest.useFakeTimers({ now: 30_000_000 });
    await setIcd001Mode('mock');
  });
  afterAll(() => {
    getIcd001Client().destroy();
    jest.useRealTimers();
  });

  it('auto on connect, read-only touch hints, explicit takeover, hand back; old firmware has no control', async () => {
    let r!: renderer.ReactTestRenderer;
    await act(async () => {
      r = renderer.create(<AdvancedControlScreen title="Manual" placeholderCards />);
    });
    expect(has(r, 'mode-switch')).toBe(false); // not connected yet
    const client = getIcd001Client();
    const transport = (client as unknown as { transport: any }).transport;
    await act(async () => {
      const p = client.connect({
        id: 'sim-ICD1-7E21',
        name: 'ICD1-7E21',
        rssi: -50,
        kind: null,
        simulated: true,
      });
      await settle();
      await p;
    });
    const dev = transport.devices.get('sim-ICD1-7E21');
    // control under the pill, Auto selected (§11.5.1 boot in auto)
    expect(has(r, 'mode-switch')).toBe(true);
    const auto = byTestID(r, 'mode-auto')[0];
    const manual = byTestID(r, 'mode-manual')[0];
    expect(auto.props.accessibilityState).toMatchObject({ selected: true });
    expect(manual.props.accessibilityState).toMatchObject({ selected: false });
    // order: pill, then mode switch, then cards
    const all = textsOf(r.root);
    expect(all.indexOf('Connected')).toBeLessThan(all.indexOf('Auto'));
    // Auto: read-only cards, sensors row, Re-zero pressure; no numbers / Hz on controls
    expect(has(r, 'readonly-wing')).toBe(true);
    expect(has(r, 'readonly-vcm')).toBe(true);
    expect(has(r, 'row-sensors')).toBe(true);
    expect(has(r, 'src-pressure-ok')).toBe(true);
    expect(has(r, 'pzero')).toBe(true);
    const controls = ['controls-wing', 'controls-vcm'].map(id => textsOf(byTestID(r, id)[0])).join('\n');
    expect(controls).not.toMatch(/\d|Hz|%/);
    // touching a read-only slider: hint only
    const n = dev.commandLog.length;
    await act(async () => {
      byTestID(r, 'readonly-wing')[0].props.onPress();
      await settle(300);
    });
    expect(textsOf(r.root)).toContain('Auto is on');
    expect(textsOf(r.root)).toContain('Tap Manual to take over.');
    expect(dev.commandLog.slice(n).filter((c: string) => c !== 'PING')).toEqual([]);
    // Re-zero pressure
    await act(async () => {
      byTestID(r, 'pzero')[0].props.onPress();
      await settle(600);
    });
    expect(dev.commandLog).toContain('PZERO');
    // explicit takeover
    await act(async () => {
      byTestID(r, 'mode-manual')[0].props.onPress();
      await settle(300);
    });
    expect(dev.commandLog).toContain('MODE MANUAL');
    expect(byTestID(r, 'mode-manual')[0].props.accessibilityState).toMatchObject({ selected: true });
    expect(has(r, 'readonly-wing')).toBe(false);
    expect(has(r, 'row-sensors')).toBe(false);
    expect(has(r, 'pzero')).toBe(false);
    const slider = r.root.findAll(n2 => n2.props.testID === 'slider-A')[0];
    expect(slider.props.disabled).toBe(false);
    // hand back
    await act(async () => {
      byTestID(r, 'mode-auto')[0].props.onPress();
      await settle(300);
    });
    expect(lastCmd(dev.commandLog)).toBe('MODE AUTO');
    expect(has(r, 'readonly-wing')).toBe(true);

    // Stop all in auto -> Stopped; Auto segment disabled while latched (§11.4.10)
    await act(async () => {
      client.setEstop(true);
      await settle(300);
    });
    expect(byTestID(r, 'mode-auto')[0].props.accessibilityState).toMatchObject({ disabled: true });
    expect(textsOf(r.root)).toContain('Tap Unlock, then Auto to resume.');
    await act(async () => {
      client.setEstop(false);
      await settle(300);
    });

    // old firmware: ICD001-0 -> no Auto | Manual, no sensors row, no Re-zero
    await act(async () => {
      await client.disconnect();
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
    expect(textsOf(r.root)).toContain('Connected');
    expect(has(r, 'mode-switch')).toBe(false);
    expect(has(r, 'row-sensors')).toBe(false);
    expect(has(r, 'pzero')).toBe(false);
    expect(r.root.findAll(n2 => n2.props.testID === 'slider-A')[0].props.disabled).toBe(false);
    await act(async () => {
      await client.disconnect();
    });
    r.unmount();
  });

  it('global "Auto on" pill: shows off-page in auto; stop button sends STOP; hidden on a control page', async () => {
    const client = getIcd001Client();
    const transport = (client as unknown as { transport: any }).transport;
    await act(async () => {
      const p = client.connect({
        id: 'sim-ICD1-7E21',
        name: 'ICD1-7E21',
        rssi: -50,
        kind: null,
        simulated: true,
      });
      await settle();
      await p;
    });
    const dev = transport.devices.get('sim-ICD1-7E21');
    const onOpen = jest.fn();
    let r!: renderer.ReactTestRenderer;
    await act(async () => {
      r = renderer.create(<AutoPill onOpen={onOpen} />);
    });
    expect(textsOf(r.root)).toContain('Auto on');
    await act(async () => {
      setControlPageFocused(true);
    });
    expect(r.toJSON()).toBeNull();
    await act(async () => {
      setControlPageFocused(false);
    });
    await act(async () => {
      byTestID(r, 'auto-pill-open')[0].props.onPress();
    });
    expect(onOpen).toHaveBeenCalled();
    await act(async () => {
      byTestID(r, 'auto-pill-stop')[0].props.onPress();
      await settle(300);
    });
    expect(dev.commandLog).toContain('STOP');
    expect(dev.mode).toBe('manual');
    expect(r.toJSON()).toBeNull(); // no longer auto
    await act(async () => {
      await client.disconnect();
    });
    r.unmount();
  });
});
