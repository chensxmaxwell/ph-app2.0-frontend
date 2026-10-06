/**
 * Manual page hosts the ICD-001 wings + pulse cards (Maxwell 2026-10-06).
 * Mode: ICD-001 session > legacy/demo link (old level slider) > ICD-001 "Not connected".
 * On the mock: same commands, Stop all / Unlock, and one STOP on leave as Advanced control.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

let mockLegacyConnected = false;
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
jest.mock('../../src/hooks/HomeScreenContext', () => ({
  useHomeScreen: () => ({
    isConnected: mockLegacyConnected,
    setCurrentMode: () => undefined,
    setMotorInput: () => undefined,
  }),
}));
jest.mock('../../src/screens/control/sub-screens/manual/sub-components/seek-bar-vertical', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SeekBarVertical: () => <View testID="legacy-seek-bar" /> };
});
jest.mock('@common/components/screen-wrapper', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { ScreenWrapper: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@common/components/back-button', () => ({ BackButton: () => null }));
jest.mock('@images/arrowtriangle-right.svg', () => 'PlayButton');
jest.mock('@images/pause.svg', () => 'PauseButton');

import { AdvancedControlScreen } from '../../src/screens/advanced-control';
import { Manual } from '../../src/screens/control/sub-screens/manual';
import { manualModeFor } from '../../src/screens/control/sub-screens/manual/icd001';
import { getIcd001Client, setIcd001Mode } from '../../src/services/icd001/useIcd001';

const flat = (c: unknown): string =>
  Array.isArray(c) ? c.map(flat).join('') : typeof c === 'string' || typeof c === 'number' ? String(c) : '';
const texts = (r: renderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => flat(n.props.children))
    .join('\n');
const byTestID = (r: renderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id);
const byLabel = (r: renderer.ReactTestRenderer, label: string) =>
  r.root.findAll(n => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label)[0];
const controlRowText = (r: renderer.ReactTestRenderer) =>
  ['controls-wing', 'controls-vcm']
    .flatMap(id => r.root.findAll(n => n.props.testID === id).slice(0, 1))
    .flatMap(c => c.findAll(n => (n.type as unknown) === 'Text').map(n => flat(n.props.children)))
    .join('\n');
const opacityOf = (style: unknown): number => {
  const list = (Array.isArray(style) ? style.flat(5) : [style]) as Array<{ opacity?: number } | null | false>;
  return list.reduce((o, st) => (st && typeof st.opacity === 'number' ? st.opacity : o), 1);
};
const settle = async (ms = 1000) => {
  for (let i = 0; i < ms / 10; i++) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

describe('manualModeFor', () => {
  const icd = (status: string, name: string | null = 'ICD1-5A3C') => ({
    status: status as never,
    device: name === null ? null : { id: 'x', name, rssi: -50, kind: null },
  });
  it('ICD-001 session wins, legacy link next, else ICD-001 cards (not connected)', () => {
    expect(manualModeFor(icd('connected'), true)).toBe('icd001');
    expect(manualModeFor(icd('connecting', 'H11-91B1'), true)).toBe('icd001');
    expect(manualModeFor(icd('reconnecting'), true)).toBe('icd001');
    expect(manualModeFor(icd('disconnected'), true)).toBe('legacy');
    expect(manualModeFor(icd('idle', null), true)).toBe('legacy');
    expect(manualModeFor(icd('idle', null), false)).toBe('icd001');
    expect(manualModeFor(icd('disconnected'), false)).toBe('icd001');
    expect(manualModeFor(icd('connected', 'ESP32'), true)).toBe('legacy');
  });
});

describe('Manual page on the mock', () => {
  beforeAll(async () => {
    jest.useFakeTimers({ now: 12_000_000 });
    await setIcd001Mode('mock');
  });
  beforeEach(() => {
    mockLegacyConnected = false;
  });
  afterAll(() => {
    getIcd001Client().destroy();
    jest.useRealTimers();
  });

  it('legacy/demo link keeps the original level slider + play', async () => {
    mockLegacyConnected = true;
    let r!: renderer.ReactTestRenderer;
    await act(async () => {
      r = renderer.create(<Manual />);
    });
    expect(texts(r)).toContain('Current Level');
    expect(byTestID(r, 'legacy-seek-bar').length).toBeGreaterThan(0);
    expect(byTestID(r, 'card-wing').length).toBe(0);
    await act(async () => {
      r.unmount();
    });
    mockLegacyConnected = false;
  });

  it('nothing connected -> Manual with Wings + Pulse & Bullet; connect, commands, Stop all, STOP on leave', async () => {
    let r!: renderer.ReactTestRenderer;
    await act(async () => {
      r = renderer.create(<Manual />);
    });
    let t = texts(r);
    expect(t).toContain('Manual');
    expect(t).not.toContain('Advanced control');
    expect(t).not.toContain('Current Level');
    expect(t).toContain('Not connected');
    expect(byTestID(r, 'card-wing').length).toBeGreaterThan(0);
    expect(byTestID(r, 'card-pulse-bullet').length).toBeGreaterThan(0);
    expect(byTestID(r, 'stop-all').length).toBeGreaterThan(0);
    // Placeholder cards before the first connect: dimmed and not touchable, no values shown.
    expect(opacityOf(byTestID(r, 'controls-wing')[0].props.style)).toBe(0.4);
    expect(byTestID(r, 'controls-wing')[0].props.pointerEvents).toBe('none');
    expect(byTestID(r, 'controls-vcm')[0].props.pointerEvents).toBe('none');
    expect(controlRowText(r)).not.toMatch(/\d|%|Hz/);
    // Advanced control itself is unchanged: no cards before a device was seen.
    let adv!: renderer.ReactTestRenderer;
    await act(async () => {
      adv = renderer.create(<AdvancedControlScreen />);
    });
    expect(texts(adv)).toContain('Advanced control');
    expect(byTestID(adv, 'card-wing').length).toBe(0);
    await act(async () => {
      adv.unmount();
    });

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
    t = texts(r);
    for (const s of [
      'Manual',
      'Connected',
      'Wings',
      'Upper wings',
      'Lower wings',
      'Pulse & Bullet',
      'Pulse speed',
      'Bullet',
    ]) {
      expect(t).toContain(s);
    }
    expect(controlRowText(r)).not.toMatch(/\d|%|Hz/);

    // An ICD-001 session wins even if a legacy/demo link is also up (no flip to the old slider).
    mockLegacyConnected = true;
    await act(async () => {
      r.update(<Manual />);
    });
    expect(byTestID(r, 'card-wing').length).toBeGreaterThan(0);
    expect(texts(r)).not.toContain('Current Level');
    mockLegacyConnected = false;

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

    dev.commandLog.length = 0;
    await act(async () => {
      byLabel(r, 'Stop all outputs').props.onPress();
      await settle(500);
    });
    expect(dev.commandLog).toContain('ESTOP 1');
    expect(texts(r)).toContain('Everything is stopped');
    dev.commandLog.length = 0;
    await act(async () => {
      byLabel(r, 'Unlock').props.onPress();
      await settle(500);
    });
    expect(dev.commandLog).toContain('ESTOP 0');

    dev.commandLog.length = 0;
    await act(async () => {
      r.unmount();
      await jest.advanceTimersByTimeAsync(50);
    });
    expect(dev.commandLog.filter((c: string) => c === 'STOP')).toEqual(['STOP']);
  });

  it('failed connect on Manual: two-line failure notice + Retry (same as Advanced / Find); Retry reconnects', async () => {
    const client = getIcd001Client();
    const transport = (client as unknown as { transport: any }).transport;
    await act(async () => {
      await client.disconnect();
    });
    let r!: renderer.ReactTestRenderer;
    await act(async () => {
      r = renderer.create(<Manual />);
    });
    transport.faults = { hang: { link: true } }; // TF 1.2 (27): connect never answers
    const device = { id: 'sim-ICD1-5A3C', name: 'ICD1-5A3C', rssi: -50, kind: null, simulated: true };
    await act(async () => {
      const p = client.connect(device);
      await settle(16_000); // 15 s cap
      await p;
    });
    expect(client.getState().status).toBe('error');
    let t = texts(r);
    expect(t).toContain('Manual');
    expect(t).toContain("Couldn't connect");
    expect(t).toContain('No answer. Keep it close, tap Retry.');
    expect(byTestID(r, 'connect-failure').length).toBeGreaterThan(0);
    expect(byTestID(r, 'card-wing').length).toBeGreaterThan(0); // cards stay (disabled)

    transport.faults = {};
    await act(async () => {
      byLabel(r, 'Retry').props.onPress();
      await settle(1000);
    });
    expect(client.getState().status).toBe('connected');
    t = texts(r);
    expect(t).not.toContain("Couldn't connect");
    expect(byTestID(r, 'connect-failure').length).toBe(0);
    expect(t).toContain('Connected');

    // Firmware without the ICD-001 service: firmware-update notice, still with Retry.
    await act(async () => {
      await client.disconnect();
    });
    transport.faults = { noService: true };
    await act(async () => {
      const p = client.connect(device);
      await settle(1000);
      await p;
    });
    t = texts(r);
    expect(t).toContain('Firmware update needed');
    expect(t).toContain('This device needs a firmware update.');
    expect(byTestID(r, 'connect-retry').length).toBeGreaterThan(0);
    transport.faults = {};
    await act(async () => {
      r.unmount();
      await jest.advanceTimersByTimeAsync(50);
    });
  });
});
