/**
 * "Find your device" (onboarding/ConnectDevice) lists only our hardware.
 * Fixture = what TestFlight 1.2 (26) showed on 2026-10-06: every nearby
 * advertiser, nameless rows, two ESP32 boards, a Mac, a watch, appliances.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  FIND_DEVICE_NAME_PREFIXES,
  LEGACY_DEVICE_NAME_PREFIXES,
  filterFoundDevices,
  isListedDeviceName,
  peripheralName,
} from '../../src/screens/onboarding/ConnectDevice/scanFilter';

type W = {
  peripheral: { id: string; name?: string | null; rssi?: number; advertising: { localName?: string } };
  connected: boolean;
};
const w = (id: string, name: string | null, rssi: number, localName?: string): W => ({
  peripheral: { id, name, rssi, advertising: localName ? { localName } : {} },
  connected: false,
});

const NEARBY: W[] = [
  w('esp-a', 'ESP32', -70),
  w('anon-1', null, -50),
  w('anon-2', '', -55),
  w('midea', 'midea', -80),
  w('watch', 'Maxwell的Apple Watch', -45),
  w('anon-3', '   ', -60),
  w('mac', 'Maxwell的MacBook Air', -40),
  w('esp-b', 'ESP32', -75),
  w('colmo', 'COLMO', -85),
  w('icd', null, -66, 'ICD1-5A3C'),
  w('h11', 'H11-91B1', -58),
  w('icd', null, -62, 'ICD1-5A3C'), // same device re-reported with a stronger signal
];

let mockBleDevice: W[] = [];
const mockStartScan = jest.fn();
const mockLegacyConnect = jest.fn();
let mockScanning = false;
const mockIcdConnect = jest.fn(async () => true);
const mockIcdDisconnect = jest.fn(async () => undefined);
const mockIcdRetry = jest.fn(async () => true);
let mockIcdState: Record<string, unknown> = { status: 'idle', device: null, tlm: null };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
    canGoBack: () => true,
    navigate: jest.fn(),
    getState: () => ({ index: 1 }),
  }),
  useRoute: () => ({ params: undefined }),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../src/hooks/useBleManager', () => ({
  useBleManager: () => ({
    startScan: mockStartScan,
    scaning: mockScanning,
    stopScan: jest.fn(),
    bleState: undefined,
    checkBleState: jest.fn(),
    bleDevice: mockBleDevice,
    connect: mockLegacyConnect,
    disconnect: jest.fn(),
    isConnected: false,
  }),
}));
jest.mock('../../src/services/icd001', () => {
  const actual = jest.requireActual('../../src/services/icd001/protocol') as Record<string, unknown>;
  return {
    ...actual,
    useIcd001: () => ({
      state: mockIcdState,
      client: { connect: mockIcdConnect, disconnect: mockIcdDisconnect, retry: mockIcdRetry },
      mode: 'ble',
    }),
  };
});
jest.mock('../../src/store/device', () => ({
  DEMO_DEVICE_ID: 'ph-demo',
  DEMO_DEVICE_NAME: 'Pleasure House',
  useDevice: () => ({
    connected: false,
    connecting: false,
    connectDemo: jest.fn(),
    disconnectDemo: jest.fn(),
    battery: 0,
  }),
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@images/icons/refresh-button.svg', () => 'RefreshButton');
jest.mock('@images/icons/ble-connect.svg', () => 'BleConnectIcon');
jest.mock('@images/icons/go-back.svg', () => 'GoBackIcon');

const { ConnectDevice } = require('../../src/screens/onboarding/ConnectDevice');

function texts(tree: renderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(t => [].concat(t.props.children as never).join(''));
}

describe('Find your device scan filter', () => {
  it('lists only ICD1- / H11- names (legacy list empty until confirmed)', () => {
    expect(FIND_DEVICE_NAME_PREFIXES).toEqual(['ICD1-', 'H11-']);
    expect(LEGACY_DEVICE_NAME_PREFIXES).toEqual([]);
    expect(isListedDeviceName('ICD1-5A3C')).toBe(true);
    expect(isListedDeviceName('h11-91b1')).toBe(true);
    for (const n of ['', '  ', 'ESP32', 'midea', 'COLMO', 'Maxwell的MacBook Air', 'Pleasure House']) {
      expect(isListedDeviceName(n)).toBe(false);
    }
  });

  it('prefers the advertised local name over the GAP name', () => {
    expect(peripheralName({ name: 'Old', advertising: { localName: ' ICD1-5A3C ' } })).toBe('ICD1-5A3C');
    expect(peripheralName({ name: null, advertising: {} })).toBe('');
  });

  it('hides blank / foreign names, de-dups by id (latest report), sorts by RSSI', () => {
    const out = filterFoundDevices(NEARBY as never);
    expect(out.map(x => [x.peripheral.id, x.peripheral.rssi])).toEqual([
      ['h11', -58],
      ['icd', -62],
    ]);
  });

  it('keeps connected if any report of that id had it', () => {
    const a = { ...w('icd', 'ICD1-5A3C', -60), connected: true };
    const b = w('icd', 'ICD1-5A3C', -50);
    expect(filterFoundDevices([a, b] as never)[0].connected).toBe(true);
  });
});

describe('Find your device screen', () => {
  beforeEach(() => {
    mockBleDevice = [];
    mockScanning = false;
    mockIcdState = { status: 'idle', device: null, tlm: null };
    mockIcdConnect.mockClear();
    mockLegacyConnect.mockClear();
    mockStartScan.mockClear();
  });

  it('shows the demo row plus only our devices from the 1.2 (26) scan', () => {
    mockBleDevice = NEARBY;
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ConnectDevice />);
    });
    const t = texts(tree);
    expect(t).toEqual(expect.arrayContaining(['Pleasure House', 'H11-91B1', 'ICD1-5A3C']));
    for (const n of ['ESP32', 'midea', 'COLMO', 'Maxwell的Apple Watch', 'Maxwell的MacBook Air']) {
      expect(t).not.toContain(n);
    }
    expect(tree.root.findAllByProps({ testID: 'find-device-empty' })).toHaveLength(0);
  });

  it('empty state after a scan finds nothing; Searching… while scanning', () => {
    mockBleDevice = NEARBY.filter(x => !['icd', 'h11'].includes(x.peripheral.id));
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ConnectDevice />);
    });
    // the scanner reported only foreign devices -> already "No device found"
    expect(texts(tree)).toContain('No device found. Tap Refresh.');
    const refresh = tree.root.findAll(
      n => n.props.onPress && texts({ root: n } as never).includes('Refresh'),
    )[0];
    act(() => refresh.props.onPress());
    expect(mockStartScan).toHaveBeenCalled();
    expect(texts(tree)).toContain('No device found. Tap Refresh.');
    mockScanning = true;
    act(() => tree.update(<ConnectDevice />));
    expect(texts(tree)).toContain('Searching…');
  });

  it('no empty-state text before any scan result', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ConnectDevice />);
    });
    expect(tree.root.findAllByProps({ testID: 'find-device-empty' })).toHaveLength(0);
  });

  it('tapping an ICD-001 row connects through the shared ICD-001 client, not the legacy path', () => {
    mockBleDevice = NEARBY;
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ConnectDevice />);
    });
    const row = tree.root.findAll(
      n => n.props.onPress && texts({ root: n } as never).join('|') === 'ICD1-5A3C',
    )[0];
    act(() => row.props.onPress());
    expect(mockIcdConnect).toHaveBeenCalledWith({ id: 'icd', name: 'ICD1-5A3C', rssi: -62, kind: 'product' });
    expect(mockLegacyConnect).not.toHaveBeenCalled();
  });

  it('pill shows Connected + device battery for an ICD-001 session; the device stays listed', () => {
    mockIcdState = {
      status: 'connected',
      device: { id: 'icd', name: 'ICD1-5A3C', rssi: -60, kind: 'product' },
      tlm: { vbat: 4.2 },
    };
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ConnectDevice />);
    });
    const t = texts(tree);
    expect(t).toEqual(expect.arrayContaining(['Connected', '100%', 'ICD1-5A3C']));
  });

  it('failed connect (TF 1.2 (27) stuck "Connecting"): pill Disconnected, two-line notice + Retry', () => {
    mockIcdState = {
      status: 'error',
      device: { id: 'h11', name: 'H11-91B1', rssi: -58, kind: 'devboard' },
      tlm: null,
      connectFailure: {
        kind: 'timeout',
        step: 'link',
        title: "Couldn't connect",
        line: 'No answer. Keep it close, tap Retry.',
      },
    };
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ConnectDevice />);
    });
    const t = texts(tree);
    expect(t).toEqual(
      expect.arrayContaining(['Disconnected', "Couldn't connect", 'No answer. Keep it close, tap Retry.']),
    );
    expect(t).not.toContain('Connecting...');
    act(() => tree.root.findByProps({ testID: 'connect-retry' }).props.onPress());
    expect(mockIcdRetry).toHaveBeenCalledTimes(1);
  });

  it('firmware-update notice when the device answered with the wrong service / no INFO', () => {
    mockIcdState = {
      status: 'error',
      device: { id: 'h11', name: 'H11-91B1', rssi: -58, kind: 'devboard' },
      tlm: null,
      connectFailure: {
        kind: 'unsupported',
        step: 'services',
        title: 'Firmware update needed',
        line: 'This device needs a firmware update.',
      },
    };
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ConnectDevice />);
    });
    expect(texts(tree)).toEqual(
      expect.arrayContaining(['Firmware update needed', 'This device needs a firmware update.']),
    );
  });
});
