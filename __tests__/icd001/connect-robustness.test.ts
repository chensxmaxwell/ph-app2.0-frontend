/**
 * TF 1.2 (27): tapping H11-91B1 in "Find your device" left the app on
 * "Connecting" forever and the board never saw a connection. Cause: a second
 * BleManager.start() (new iOS CBCentralManager, not powered on) right before
 * BleManager.connect(), which iOS drops silently, and no connect timeout.
 * Covers: one shared start, wait for powered on, per-step + overall timeouts
 * with cleanup, failure notices + Retry, firmware-update notice, bounded
 * reconnect, connect step log.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NativeModules } from 'react-native';

import { AdvancedControlController } from '../../src/screens/advanced-control/controller';
import { BluetoothOffError, createBleStarter } from '../../src/services/icd001/bleStart';
import { Icd001Client } from '../../src/services/icd001/client';
import { CONNECT_TIMEOUT_MS, STEP_TIMEOUT_MS } from '../../src/services/icd001/connectSteps';
import { MockIcd001Device, MockIcd001Transport } from '../../src/services/icd001/mock';

const tick = async (ms: number) => {
  for (let i = 0; i < ms; i += 50) {
    await jest.advanceTimersByTimeAsync(50);
  }
};

// ---------------------------------------------------------------- react-native-ble-manager fake (iOS semantics)
type Fn = (...a: unknown[]) => unknown;
const ble: Record<string, jest.Mock<Fn>> = {};
let bleState = 'unknown';
let stateListener: ((e: { state: string }) => void) | null = null;
const resetBle = () => {
  bleState = 'unknown';
  Object.assign(ble, {
    start: jest.fn(async () => {
      // A fresh CBCentralManager powers on asynchronously.
      setTimeout(() => {
        bleState = 'on';
        stateListener?.({ state: 'on' });
      }, 300);
    }),
    checkState: jest.fn(async () => bleState),
    connect: jest.fn(() => new Promise(() => undefined)), // iOS: never answers by itself
    disconnect: jest.fn(async () => undefined),
    stopNotification: jest.fn(async () => undefined),
    retrieveServices: jest.fn(async () => ({
      services: [{ uuid: '6E400001-4831-4D31-9A00-000000000001' }],
      characteristics: [
        {
          service: '6E400001-4831-4D31-9A00-000000000001',
          characteristic: '6E400002-4831-4D31-9A00-000000000001',
        },
        {
          service: '6E400001-4831-4D31-9A00-000000000001',
          characteristic: '6E400003-4831-4D31-9A00-000000000001',
        },
      ],
    })),
    startNotification: jest.fn(async () => undefined),
    read: jest.fn(async () => []),
    write: jest.fn(async () => undefined),
    writeWithoutResponse: jest.fn(async () => undefined),
    scan: jest.fn(async () => undefined),
    stopScan: jest.fn(async () => undefined),
    requestMTU: jest.fn(async () => 185),
  });
};
resetBle();
jest.mock('react-native-ble-manager', () => ({
  __esModule: true,
  default: new Proxy(
    {},
    {
      get:
        (_t, k: string) =>
        (...a: unknown[]) =>
          ble[k](...a),
    },
  ),
  BleScanMode: { LowLatency: 2 },
}));
(NativeModules as Record<string, unknown>).BleManager = {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return {
    __esModule: true,
    default: class {
      addListener(name: string, cb: (e: { state: string }) => void) {
        if (name === 'BleManagerDidUpdateState') {
          stateListener = cb;
        }
        return { remove: () => undefined };
      }
    },
  };
});

describe('one BleManager.start() per run, then wait for powered on (bleStart)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('concurrent / repeated callers share one native start()', async () => {
    const start = jest.fn(async () => undefined);
    const s = createBleStarter({ start, checkState: async () => 'on', onState: () => () => undefined });
    await Promise.all([s.ensureStarted(), s.ensureStarted(), s.ensurePoweredOn()]);
    await s.ensurePoweredOn();
    expect(start).toHaveBeenCalledTimes(1);
    expect(s.startCount).toBe(1);
  });

  it('waits for the state event after a fresh start (unknown -> on)', async () => {
    let cb: ((st: string) => void) | null = null;
    let st = 'unknown';
    const s = createBleStarter({
      start: async () => undefined,
      checkState: async () => st,
      onState: f => {
        cb = f;
        return () => undefined;
      },
    });
    let done = false;
    s.ensurePoweredOn(3000).then(() => (done = true));
    await tick(200);
    expect(done).toBe(false);
    st = 'on';
    cb!('on');
    await tick(50);
    expect(done).toBe(true);
  });

  it('Bluetooth off -> BluetoothOffError after the limit (no hang)', async () => {
    const s = createBleStarter({
      start: async () => undefined,
      checkState: async () => 'off',
      onState: () => () => undefined,
    });
    const p = s.ensurePoweredOn(1000).then(
      () => null,
      (e: unknown) => e,
    );
    await tick(1100);
    expect(await p).toBeInstanceOf(BluetoothOffError);
  });

  it('a failed native start can be retried', async () => {
    let n = 0;
    const s = createBleStarter({
      start: async () => {
        n++;
        if (n === 1) {
          throw new Error('boom');
        }
      },
      checkState: async () => 'on',
      onState: () => () => undefined,
    });
    await expect(s.ensureStarted()).rejects.toThrow('boom');
    await s.ensureStarted();
    expect(s.startCount).toBe(2);
  });
});

describe('real BLE transport on the iOS fake (the 1.2 (27) failure)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    resetBle();
    stateListener = null;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const load = () => {
    // fresh module state (shared starter singleton) per test
    const { BleIcd001Transport } = require('../../src/services/icd001/bleTransport');
    const { ensureBleStarted } = require('../../src/services/icd001/bleStart');
    const { Icd001Client: Client } = require('../../src/services/icd001/client');
    return { BleIcd001Transport, ensureBleStarted, Client };
  };
  const H11 = { id: 'H11-UUID', name: 'H11-91B1', rssi: -58, kind: 'devboard' as const };

  it('legacy scanner start + ICD-001 connect: BleManager.start() runs once; connect only after powered on', async () => {
    const { BleIcd001Transport, ensureBleStarted, Client } = load();
    await ensureBleStarted(); // "Find your device" (useBleManager) on mount
    const client = new Client(new BleIcd001Transport());
    client.connect(H11);
    await tick(100);
    expect(ble.start).toHaveBeenCalledTimes(1);
    expect(ble.connect).not.toHaveBeenCalled(); // adapter still 'unknown'
    await tick(400);
    expect(ble.connect).toHaveBeenCalledWith('H11-UUID');
    expect(ble.start).toHaveBeenCalledTimes(1);
    client.destroy();
  });

  it('connect never answered -> link timeout (10 s), pending connect cancelled, "Couldn\'t connect" + step log', async () => {
    const { BleIcd001Transport, Client } = load();
    const client = new Client(new BleIcd001Transport());
    const p = client.connect(H11);
    await tick(STEP_TIMEOUT_MS.link + 1000);
    expect(await p).toBe(false);
    const s = client.getState();
    expect(s.status).toBe('error');
    expect(s.connectFailure).toMatchObject({ kind: 'timeout', step: 'link', title: "Couldn't connect" });
    expect(ble.disconnect).toHaveBeenCalledWith('H11-UUID'); // cancelPeripheralConnection
    expect(s.connectLog.join('\n')).toMatch(/… bluetooth[\s\S]*… link[\s\S]*FAILED at link: timeout/);
    expect(s.connectStep).toBeNull();
    client.destroy();
  });

  it('connected but no ICD-001 service (other firmware) -> "Firmware update needed"', async () => {
    const { BleIcd001Transport, Client } = load();
    ble.connect.mockImplementation(async () => undefined);
    ble.retrieveServices.mockImplementation(async () => ({
      services: [{ uuid: '180A' }],
      characteristics: [],
    }));
    const client = new Client(new BleIcd001Transport());
    const p = client.connect(H11);
    await tick(1000);
    expect(await p).toBe(false);
    expect(client.getState().connectFailure).toMatchObject({
      kind: 'unsupported',
      step: 'services',
      title: 'Firmware update needed',
      line: 'This device needs a firmware update.',
    });
    expect(ble.startNotification).not.toHaveBeenCalled();
    client.destroy();
  });

  it('scan waits for powered on too (Manual / Advanced Scan uses the same starter)', async () => {
    const { BleIcd001Transport, Client } = load();
    const client = new Client(new BleIcd001Transport());
    client.startScan();
    await tick(100);
    expect(ble.scan).not.toHaveBeenCalled();
    await tick(400);
    expect(ble.scan).toHaveBeenCalledTimes(1);
    expect(ble.start).toHaveBeenCalledTimes(1);
    client.destroy();
  });
});

describe('client connect steps on the simulator (fault injection)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 30_000_000 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const setup = (variant: 'icd1v1' | 'icd1' | 'h11' = 'icd1v1') => {
    const dev = new MockIcd001Device(variant, variant === 'h11' ? 'H11-91B1' : 'ICD1-7E21');
    const transport = new MockIcd001Transport([dev], { mtu: 185, connectDelayMs: 10 });
    const client = new Icd001Client(transport, { reconnectDelaysMs: [100, 100] });
    const device = { id: `sim-${dev.name}`, name: dev.name, rssi: -50, kind: null, simulated: true };
    return { dev, transport, client, device };
  };

  for (const hang of ['services', 'notify'] as const) {
    it(`${hang} never answers -> timeout at ${hang}, cleanup, error + notice`, async () => {
      const t = setup();
      t.transport.faults = { hang: { [hang]: true } };
      const p = t.client.connect(t.device);
      await tick(CONNECT_TIMEOUT_MS + 500);
      expect(await p).toBe(false);
      // the transport's sub-step is bounded only by the overall cap on the mock
      expect(t.client.getState()).toMatchObject({ status: 'error', connectStep: null });
      expect(t.client.getState().connectFailure).toMatchObject({
        kind: 'timeout',
        title: "Couldn't connect",
      });
      expect(t.client.getState().connectLog.join('\n')).toContain(`… ${hang}`);
      expect(t.transport.disconnectCalls).toBe(1);
      t.client.destroy();
    });
  }

  it('overall cap: the whole connect never takes longer than 15 s', async () => {
    const t = setup();
    t.transport.faults = { hang: { link: true } };
    const t0 = Date.now();
    let settled = 0;
    t.client.connect(t.device).then(() => (settled = Date.now()));
    await tick(CONNECT_TIMEOUT_MS + 1000);
    expect(settled - t0).toBeLessThanOrEqual(CONNECT_TIMEOUT_MS + 100);
    expect(t.client.getState().status).toBe('error');
    t.client.destroy();
  });

  it('INFO read hangs and INFO command unanswered -> "Firmware update needed" (no hang)', async () => {
    const t = setup();
    t.transport.faults = { hang: { info: true, infoCmd: true } };
    const p = t.client.connect(t.device);
    await tick(STEP_TIMEOUT_MS.info + STEP_TIMEOUT_MS['info-cmd'] + 500);
    expect(await p).toBe(false);
    expect(t.client.getState().connectFailure).toMatchObject({ kind: 'unsupported', step: 'info' });
    t.client.destroy();
  });

  it('INFO characteristic not INFO JSON, but the INFO command answers -> connects', async () => {
    const t = setup('icd1');
    t.transport.faults = { badInfo: true };
    const p = t.client.connect(t.device);
    await tick(600);
    expect(await p).toBe(true);
    expect(t.client.getState().status).toBe('connected');
    t.client.destroy();
  });

  it('Bluetooth off -> "Bluetooth is off" notice', async () => {
    const t = setup();
    t.transport.faults = { bluetoothOff: true };
    expect(await t.client.connect(t.device)).toBe(false);
    expect(t.client.getState().connectFailure).toMatchObject({
      kind: 'bluetooth',
      title: 'Bluetooth is off',
    });
    t.client.destroy();
  });

  it('Advanced control: failure notice with Retry; Retry connects the same device', async () => {
    const t = setup();
    const ctl = new AdvancedControlController(t.client);
    ctl.start();
    t.transport.faults = { linkError: true };
    await t.client.connect(t.device);
    await tick(50);
    expect(ctl.getView().banner).toMatchObject({ title: "Couldn't connect", action: 'retry' });
    t.transport.faults = {};
    ctl.retry();
    await tick(600);
    expect(t.client.getState().status).toBe('connected');
    expect(t.client.getState().connectFailure).toBeNull();
    expect(ctl.getView().banner?.action).not.toBe('retry');
    expect(t.client.getState().connectLog.join('\n')).toMatch(/FAILED at link[\s\S]*connected in \d+ ms/);
    ctl.dispose();
    t.client.destroy();
  });

  it('reconnect is bounded: each attempt times out, gives up after the cap with a Retry notice', async () => {
    const t = setup();
    t.client.connect(t.device);
    await tick(300);
    expect(t.client.getState().status).toBe('connected');
    const calls = t.transport.connectCalls;
    t.transport.faults = { hang: { link: true } };
    t.transport.simulateLinkLoss(t.device.id);
    await tick(2 * (CONNECT_TIMEOUT_MS + 200) + 1000);
    const s = t.client.getState();
    expect(t.transport.connectCalls - calls).toBe(2); // = reconnectDelaysMs.length
    expect(s.status).toBe('disconnected');
    expect(s.connectFailure).toMatchObject({ title: "Couldn't connect" });
    expect(s.connectLog.join('\n')).toContain('reconnect: gave up after 2 attempts');
    await tick(20_000);
    expect(t.transport.connectCalls - calls).toBe(2); // no endless loop
    t.client.destroy();
  }, 15_000);

  it('a second tap supersedes a stuck connect; the stale attempt never tears the new link down', async () => {
    const t = setup();
    t.transport.faults = { hang: { link: true } };
    t.client.connect(t.device);
    await tick(1000);
    t.transport.faults = {};
    expect(
      await (async () => {
        const p = t.client.connect(t.device);
        await tick(600);
        return p;
      })(),
    ).toBe(true);
    await tick(CONNECT_TIMEOUT_MS + 1000); // the first attempt's timer fires
    expect(t.client.getState().status).toBe('connected');
    expect(t.client.getState().connectFailure).toBeNull();
    t.client.destroy();
  });

  it('user Disconnect during a stuck connect: no late error, stays disconnected', async () => {
    const t = setup();
    t.transport.faults = { hang: { link: true } };
    t.client.connect(t.device);
    await tick(1000);
    await t.client.disconnect();
    await tick(CONNECT_TIMEOUT_MS + 1000);
    expect(t.client.getState()).toMatchObject({ status: 'disconnected', connectFailure: null });
    t.client.destroy();
  });
});
