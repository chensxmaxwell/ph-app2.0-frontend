/**
 * One BleManager.start() per app run, shared by the legacy scanner
 * (hooks/useBleManager) and the ICD-001 transport.
 *
 * react-native-ble-manager 11 on iOS creates a NEW CBCentralManager on every
 * start() (ios/BleManager.swift start()). TF 1.2 (27): "Find your device"
 * started it (legacy hook, scan), then the ICD-001 transport started it again
 * right before BleManager.connect(): the new manager was not powered on yet
 * and the CBPeripheral came from the old one, so iOS dropped the connect
 * silently (no didConnect / didFailToConnect) -> "Connecting" forever, and the
 * board never saw a connection. A second start() under a live link can also
 * drop it. Never call BleManager.start() anywhere else.
 */
import { NativeEventEmitter, NativeModules } from 'react-native';
import BleManager from 'react-native-ble-manager';

export interface BleStartApi {
  start(): Promise<void>;
  checkState(): Promise<string>;
  /** Subscribe to BleManagerDidUpdateState; returns unsubscribe. */
  onState(cb: (state: string) => void): () => void;
}

export interface BleStarter {
  /** start() exactly once per run (concurrent callers share it). */
  ensureStarted(): Promise<void>;
  /** ensureStarted() + wait until the adapter is powered on; throws BluetoothOffError. */
  ensurePoweredOn(timeoutMs?: number): Promise<void>;
  /** Native start() calls so far (tests: must stay 1). */
  readonly startCount: number;
}

export class BluetoothOffError extends Error {
  constructor(readonly state: string) {
    super(
      state === 'unauthorized' ? 'Bluetooth permission denied' : `Bluetooth is ${state || 'unavailable'}`,
    );
    this.name = 'BluetoothOffError';
  }
}

export function createBleStarter(api: BleStartApi): BleStarter {
  let started: Promise<void> | null = null;
  let count = 0;
  const ensureStarted = (): Promise<void> => {
    if (!started) {
      count += 1;
      started = api.start().catch(e => {
        started = null; // allow a later retry if the native start itself failed
        throw e;
      });
    }
    return started;
  };
  const ensurePoweredOn = async (timeoutMs = 3000): Promise<void> => {
    await ensureStarted();
    let last = await api.checkState().catch(() => 'unknown');
    if (last === 'on') {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timer);
        clearInterval(poll);
        unsub();
        if (ok) {
          resolve();
        } else {
          reject(new BluetoothOffError(last));
        }
      };
      const seen = (s: string) => {
        last = s;
        if (s === 'on') {
          finish(true);
        }
      };
      const unsub = api.onState(seen);
      // A fresh CBCentralManager reports 'unknown' first; poll as well in case the event was missed.
      const poll = setInterval(() => {
        api.checkState().then(seen, () => undefined);
      }, 250);
      const timer = setTimeout(() => finish(false), timeoutMs);
    });
  };
  return {
    ensureStarted,
    ensurePoweredOn,
    get startCount() {
      return count;
    },
  };
}

let shared: BleStarter | null = null;

/** The app-wide starter on react-native-ble-manager. */
export function getBleStarter(): BleStarter {
  if (!shared) {
    shared = createBleStarter({
      start: () => BleManager.start({ showAlert: false }),
      checkState: () => BleManager.checkState().then(s => String(s)),
      onState: cb => {
        const emitter = new NativeEventEmitter(NativeModules.BleManager);
        const sub = emitter.addListener('BleManagerDidUpdateState', (e: { state?: string }) =>
          cb(String(e?.state ?? '')),
        );
        return () => sub.remove();
      },
    });
  }
  return shared;
}

/** Shorthand used by the legacy hook. */
export function ensureBleStarted(): Promise<void> {
  return getBleStarter().ensureStarted();
}
