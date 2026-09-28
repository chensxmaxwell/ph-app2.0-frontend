/**
 * SAFETY RULE (design v2 sign-off): while a sheet/overlay is open on the
 * advanced-control page, Stop all stays visible, tappable and undimmed above the
 * scrim and the sheet; tapping it closes the sheet and sends ESTOP 1.
 * See src/screens/advanced-control/components/OverlayHost.tsx.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act, ReactTestInstance } from 'react-test-renderer';

jest.mock('react-native-ble-manager', () => ({}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => undefined,
  useRoute: () => ({ name: 'AdvancedControl', params: { expanded: 'wing' } }),
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
import { STOP_BUTTON_H } from '../../src/screens/advanced-control/components/OverlayHost';
import { getIcd001Client, setIcd001Mode } from '../../src/services/icd001/useIcd001';

const settle = async (ms: number) => {
  for (let i = 0; i < ms / 10; i++) {
    await jest.advanceTimersByTimeAsync(10);
  }
};
const byTestId = (r: renderer.ReactTestRenderer, id: string) =>
  r.root.findAll(n => n.props.testID === id && typeof n.type !== 'string');
const one = (r: renderer.ReactTestRenderer, id: string) => byTestId(r, id)[0];
const contains = (outer: ReactTestInstance, inner: ReactTestInstance) =>
  outer.findAll(n => n === inner).length > 0;
const flat = (n: ReactTestInstance) => {
  const st = n.props.style;
  return StyleSheet.flatten(typeof st === 'function' ? st({ pressed: false }) : st) ?? {};
};
const ancestors = (n: ReactTestInstance) => {
  const out: ReactTestInstance[] = [];
  for (let p = n.parent; p; p = p.parent) {
    out.push(p);
  }
  return out;
};

describe('Stop-all safety rule with the Fine tune sheet open', () => {
  let r!: renderer.ReactTestRenderer;
  const log = () => getIcd001Client().getState().log;

  beforeAll(async () => {
    jest.useFakeTimers({ now: 12_000_000 });
    await setIcd001Mode('mock');
    await act(async () => {
      r = renderer.create(<AdvancedControlScreen />);
    });
    await act(async () => {
      const p = getIcd001Client().connect({
        id: 'sim-ICD1-5A3C',
        name: 'ICD1-5A3C',
        rssi: -50,
        kind: null,
        simulated: true,
      });
      await settle(1000);
      await p;
    });
    // Wings row is open via the route param; open the Fine tune sheet.
    await act(async () => {
      r.root
        .findAll(
          n =>
            typeof n.props.onPress === 'function' &&
            /^Fine tune, vibration frequency/.test(n.props.accessibilityLabel ?? ''),
        )[0]
        .props.onPress();
      await settle(400);
    });
    expect(byTestId(r, 'overlay-host').length).toBeGreaterThan(0);
  });
  afterAll(() => {
    act(() => r.unmount());
    getIcd001Client().destroy();
    jest.useRealTimers();
  });

  it('the scrim does not cover Stop all (Stop all is above it, outside the scrimmed area)', () => {
    const host = one(r, 'overlay-host');
    const scrim = one(r, 'overlay-scrim');
    const sheet = one(r, 'overlay-sheet');
    const stop = one(r, 'stop-all');
    // Not inside the overlay (never moved into the sheet, never under its scrim).
    expect(contains(host, stop)).toBe(false);
    // Z-order: Stop all is rendered after the overlay host in the page root.
    const root = r.root.findAll(n => n.props.testID === 'advanced-control' && typeof n.type === 'string')[0];
    const kids = root.children.filter((c): c is ReactTestInstance => typeof c !== 'string');
    const hostIdx = kids.findIndex(k => k === host || contains(k, host));
    const stopIdx = kids.findIndex(k => k === stop || contains(k, stop));
    expect(hostIdx).toBeGreaterThanOrEqual(0);
    expect(stopIdx).toBeGreaterThan(hostIdx);
    // Geometry: scrim and sheet end at or above the top edge of Stop all.
    const s = flat(stop);
    const stopTop = (s.bottom as number) + STOP_BUTTON_H;
    expect(flat(scrim).bottom as number).toBeGreaterThanOrEqual(stopTop);
    expect(flat(sheet).bottom as number).toBeGreaterThanOrEqual(stopTop);
    // Undimmed: no opacity applied to Stop all or anything above it.
    for (const n of [stop, ...ancestors(stop)]) {
      const o = flat(n).opacity;
      expect(o === undefined || o === 1).toBe(true);
    }
  });

  it('Stop all can be pressed while the sheet is open', () => {
    const stop = one(r, 'stop-all');
    expect(typeof stop.props.onPress).toBe('function');
    expect(stop.props.disabled).toBeFalsy();
    for (const n of [stop, ...ancestors(stop)]) {
      expect(['none', 'box-only']).not.toContain(n.props.pointerEvents);
    }
  });

  it('pressing Stop all closes the sheet and sends ESTOP 1', async () => {
    const before = log().length;
    await act(async () => {
      one(r, 'stop-all').props.onPress();
      await settle(500);
    });
    expect(byTestId(r, 'overlay-host')).toHaveLength(0);
    expect(
      log()
        .slice(before)
        .some(l => /ESTOP 1/.test(l)),
    ).toBe(true);
    expect(byTestId(r, 'stop-all')).toHaveLength(0); // dock now shows Stopped + Release
  });
});
