/**
 * Real BLE transport on react-native-ble-manager (already a dependency, v11).
 */
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import BleManager, { BleScanMode } from 'react-native-ble-manager';

import { getBleStarter } from './bleStart';
import { ConnectStep, ConnectStepError, STEP_TIMEOUT_MS, toStepError, withTimeout } from './connectSteps';
import {
  ICD001_CMD_UUID,
  ICD001_INFO_UUID,
  ICD001_MIN_WRITE_BYTES,
  ICD001_REQUESTED_MTU,
  ICD001_SERVICE_UUID,
  ICD001_TLM_UUID,
  acceptScanResult,
  classifyDeviceName,
} from './protocol';

import type { ConnectResult, DiscoveredDevice, Icd001Transport } from './transport';
import type { Peripheral } from 'react-native-ble-manager';

const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Android runtime permissions. iOS prompts via NSBluetoothAlwaysUsageDescription. */
export async function ensureBlePermissions(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const api =
    typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  const perms =
    api >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const res = await PermissionsAndroid.requestMultiple(perms);
  const denied = perms.filter(p => res[p] !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied.length) {
    throw new Error(
      `需要蓝牙权限才能连接设备（${denied.map(p => p.replace('android.permission.', '')).join(', ')}）`,
    );
  }
}

export class BleIcd001Transport implements Icd001Transport {
  readonly kind = 'ble' as const;
  private started = false;
  private emitter: NativeEventEmitter | null = null;
  private notifyCbs = new Set<(id: string, bytes: number[]) => void>();
  private discCbs = new Set<(id: string) => void>();
  private scanCb: ((d: DiscoveredDevice) => void) | null = null;
  private mtus = new Map<string, number>();

  async init(): Promise<void> {
    await ensureBlePermissions();
    // One BleManager.start() per app run (bleStart.ts): a second start() makes a
    // new iOS CBCentralManager and silently breaks connect / a live link.
    await getBleStarter().ensureStarted();
    if (this.started) {
      return;
    }
    const emitter = new NativeEventEmitter(NativeModules.BleManager);
    emitter.addListener('BleManagerDiscoverPeripheral', (p: Peripheral) => this.handleDiscover(p));
    emitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      (e: { peripheral: string; characteristic: string; service?: string; value: number[] }) => {
        if (sameUuid(e.characteristic, ICD001_TLM_UUID)) {
          this.notifyCbs.forEach(cb => cb(e.peripheral, e.value));
        }
      },
    );
    emitter.addListener('BleManagerDisconnectPeripheral', (e: { peripheral: string }) => {
      this.mtus.delete(e.peripheral);
      this.discCbs.forEach(cb => cb(e.peripheral));
    });
    this.emitter = emitter;
    this.started = true;
  }

  private handleDiscover(p: Peripheral): void {
    if (!this.scanCb) {
      return;
    }
    // OS already filtered on the service UUID; the name comes from the scan
    // response (allowDuplicates=true re-reports the device once it arrives).
    const name = p.advertising?.localName || p.name || null;
    if (!acceptScanResult(name)) {
      return;
    }
    this.scanCb({ id: p.id, name, rssi: p.rssi ?? null, kind: classifyDeviceName(name) });
  }

  async startScan(onDevice: (d: DiscoveredDevice) => void, timeoutMs: number): Promise<void> {
    await this.poweredOn();
    this.scanCb = onDevice;
    // Filter by service UUID (only thing in the adv packet). Scanning is active:
    // Android ScanSettings and iOS foreground scans request the scan response,
    // which carries the ICD1-/H11- name. LowLatency so the name shows quickly.
    await BleManager.scan([ICD001_SERVICE_UUID], Math.max(1, Math.round(timeoutMs / 1000)), true, {
      scanMode: BleScanMode.LowLatency,
    });
  }

  async stopScan(): Promise<void> {
    this.scanCb = null;
    await BleManager.stopScan().catch(() => undefined);
  }

  /** Shared start + adapter powered on (a fresh CBCentralManager drops commands until then). */
  private async poweredOn(): Promise<void> {
    try {
      await getBleStarter().ensurePoweredOn(STEP_TIMEOUT_MS.bluetooth);
    } catch (e) {
      throw new ConnectStepError('bluetooth', 'bluetooth', e instanceof Error ? e.message : String(e));
    }
  }

  async connect(id: string, onStep?: (s: ConnectStep) => void): Promise<ConnectResult> {
    const step = async <T>(name: ConnectStep, run: () => Promise<T>): Promise<T> => {
      onStep?.(name);
      try {
        return await withTimeout(run(), STEP_TIMEOUT_MS[name], name);
      } catch (e) {
        throw toStepError(e, name);
      }
    };
    onStep?.('bluetooth');
    await this.poweredOn();
    // iOS connect never times out by itself; the client cancels it (disconnect) on timeout.
    await step('link', () => BleManager.connect(id));
    let mtu = 23;
    if (Platform.OS === 'android') {
      mtu = await step('mtu', () => BleManager.requestMTU(id, ICD001_REQUESTED_MTU)).catch(() => 23);
    }
    // iOS negotiates MTU itself (typically 185); ble-manager can't query it,
    // and every command we send is <= 20 bytes anyway.
    this.mtus.set(id, mtu);
    const info = await step('services', () => BleManager.retrieveServices(id, [ICD001_SERVICE_UUID]));
    const hasSvc = (info.services ?? []).some(sv => sameUuid(String(sv.uuid), ICD001_SERVICE_UUID));
    const chars = (info.characteristics ?? []).map(c => String(c.characteristic));
    const hasChar = (u: string) => chars.some(c => sameUuid(c, u));
    if (!hasSvc || !hasChar(ICD001_TLM_UUID) || !hasChar(ICD001_CMD_UUID)) {
      // Connected, but not the ICD-001 service (old / other firmware).
      throw new ConnectStepError('services', 'unsupported', 'ICD-001 service or characteristics missing');
    }
    await step('notify', () => BleManager.startNotification(id, ICD001_SERVICE_UUID, ICD001_TLM_UUID));
    return { mtu };
  }

  async disconnect(id: string): Promise<void> {
    // Also cancels a pending (never answered) iOS connect; each call bounded.
    await withTimeout(
      BleManager.stopNotification(id, ICD001_SERVICE_UUID, ICD001_TLM_UUID),
      1500,
      'cleanup',
    ).catch(() => undefined);
    await withTimeout(BleManager.disconnect(id), STEP_TIMEOUT_MS.cleanup, 'cleanup').catch(() => undefined);
    this.mtus.delete(id);
  }

  readInfo(id: string): Promise<number[]> {
    return BleManager.read(id, ICD001_SERVICE_UUID, ICD001_INFO_UUID);
  }

  async write(id: string, bytes: number[], withResponse: boolean, allowSplit: boolean): Promise<void> {
    const max = Math.max(ICD001_MIN_WRITE_BYTES, (this.mtus.get(id) ?? 23) - 3);
    if (bytes.length > max && !allowSplit) {
      // H11 v1.0 would treat a split write as two commands; refuse instead.
      throw new Error(`command too long for one BLE write (${bytes.length} > ${max})`);
    }
    if (withResponse) {
      await BleManager.write(id, ICD001_SERVICE_UUID, ICD001_CMD_UUID, bytes, max);
    } else {
      await BleManager.writeWithoutResponse(id, ICD001_SERVICE_UUID, ICD001_CMD_UUID, bytes, max);
    }
  }

  onNotify(cb: (id: string, bytes: number[]) => void): () => void {
    this.notifyCbs.add(cb);
    return () => this.notifyCbs.delete(cb);
  }

  onDisconnected(cb: (id: string) => void): () => void {
    this.discCbs.add(cb);
    return () => this.discCbs.delete(cb);
  }
}
