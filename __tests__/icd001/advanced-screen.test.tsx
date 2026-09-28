/**
 * Design v2 screen on the simulator: notices, module rows with live values,
 * expanding a row (no Fine tune), Stop all / Release, and STOP on leave.
 * Also the Control-home entry (Q9: visible only while ICD1-/H11- connected).
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
import { partAt } from '../../src/screens/advanced-control/components/Stage';
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
const settle = async (ms = 1000) => {
  for (let i = 0; i < ms / 10; i++) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

describe('isAdvancedDevice / partAt', () => {
  it('shows the entry only for a connected ICD1- / H11- device', () => {
    expect(isAdvancedDevice('connected', 'ICD1-91B1')).toBe(true);
    expect(isAdvancedDevice('connected', 'H11-0001')).toBe(true);
    expect(isAdvancedDevice('connected', 'Other')).toBe(false);
    expect(isAdvancedDevice('connecting', 'ICD1-91B1')).toBe(false);
    expect(isAdvancedDevice('connected', null)).toBe(false);
  });
  it('maps hero points to parts with head and bullet winning overlaps', () => {
    expect(partAt(185, 80)).toBe('head');
    expect(partAt(140, 80)).toBe('upper');
    expect(partAt(60, 130)).toBe('lower');
    expect(partAt(340, 25)).toBe('bullet');
    expect(partAt(-5, -5)).toBeNull();
  });
});

describe('AdvancedControlScreen v2 on the mock', () => {
  beforeAll(async () => {
    jest.useFakeTimers({ now: 11_000_000 });
    await setIcd001Mode('mock');
  });
  afterAll(() => {
    getIcd001Client().destroy();
    jest.useRealTimers();
  });

  it('walks disconnected -> normal -> expand -> fine tune -> stop/release -> leave', async () => {
    let r!: renderer.ReactTestRenderer;
    let entry!: renderer.ReactTestRenderer;
    await act(async () => {
      r = renderer.create(<AdvancedControlScreen />);
      entry = renderer.create(<AdvancedEntry />);
    });
    expect(texts(r)).toContain('Not connected');
    expect(entry.toJSON()).toBeNull();

    const client = getIcd001Client();
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
    let t = texts(r);
    expect(t).toContain('ICD1-5A3C');
    expect(t).toContain('Connected');
    expect(t).toContain('Wings');
    expect(t).toContain('Upper and lower pairs');
    expect(t).toContain('Pulse');
    expect(t).toContain('Voice coil rhythm');
    expect(t).toContain('Bullet');
    expect(t).toContain('Leaving this page stops all outputs.');
    expect(t).not.toContain('Not connected');
    expect(entry.root.findAll(n => n.props.testID === 'advanced-entry').length).toBeGreaterThan(0);
    expect(texts(entry)).toContain('Each part on its own');

    // Expand Wings, raise upper wings through the a11y action.
    await act(async () => {
      byLabel(r, /^Wings\. Upper and lower pairs\./).props.onPress();
      await settle(100);
    });
    t = texts(r);
    expect(t).toContain('Upper wings');
    expect(t).toContain('Lower wings');
    expect(t).toContain('Pattern');
    expect(t).not.toContain('Leaving this page stops all outputs.');
    const upper = r.root.find(
      n => n.props.accessibilityLabel === 'Upper wings' && n.props.onAccessibilityAction,
    );
    await act(async () => {
      upper.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
      await settle(300);
    });
    expect(client.getState().log.some(l => /LRA/.test(l))).toBe(true);
    // Wing frequency is fixed at 170 Hz: no Fine tune row or sheet.
    expect(texts(r)).not.toContain('Fine tune');

    // Stop all -> emergency stop notice + Release (single tap).
    await act(async () => {
      byLabel(r, 'Stop all outputs').props.onPress();
      await settle(500);
    });
    t = texts(r);
    expect(t).toContain('Emergency stop is on');
    expect(t).toContain('Stopped');
    await act(async () => {
      byLabel(r, 'Release emergency stop').props.onPress();
      await settle(500);
    });
    expect(texts(r)).not.toContain('Emergency stop is on');

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
