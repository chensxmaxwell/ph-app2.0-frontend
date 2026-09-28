/**
 * Real BLE transport on react-native-ble-manager (already a dependency, v11).
 */
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import BleManager from 'react-native-ble-manager';

import {
  ICD001_CMD_UUID,
  ICD001_INFO_UUID,
  ICD001_MIN_WRITE_BYTES,
  ICD001_REQUESTED_MTU,
  ICD001_SERVICE_UUID,
  ICD001_TLM_UUID,
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
    if (this.started) {
      return;
    }
    await BleManager.start({ showAlert: false });
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
    const name = p.advertising?.localName || p.name || null;
    const kind = classifyDeviceName(name);
    const hasSvc = (p.advertising?.serviceUUIDs || []).some(u => sameUuid(u, ICD001_SERVICE_UUID));
    // Name prefix ICD1- / H11- is the filter; a device that only advertises the
    // service UUID (name still in the pending scan response) is also accepted.
    if (!kind && !(hasSvc && !name)) {
      return;
    }
    this.scanCb({ id: p.id, name, rssi: p.rssi ?? null, kind });
  }

  async startScan(onDevice: (d: DiscoveredDevice) => void, timeoutMs: number): Promise<void> {
    this.scanCb = onDevice;
    // Firmware advertises the service UUID (name is in the scan response).
    await BleManager.scan([ICD001_SERVICE_UUID], Math.max(1, Math.round(timeoutMs / 1000)), true);
  }

  async stopScan(): Promise<void> {
    this.scanCb = null;
    await BleManager.stopScan().catch(() => undefined);
  }

  async connect(id: string): Promise<ConnectResult> {
    await BleManager.connect(id);
    let mtu = 23;
    if (Platform.OS === 'android') {
      try {
        mtu = await BleManager.requestMTU(id, ICD001_REQUESTED_MTU);
      } catch {
        mtu = 23;
      }
    } else {
      // iOS negotiates MTU itself (typically 185); ble-manager can't query it,
      // and every command we send is <= 20 bytes anyway.
      mtu = 23;
    }
    this.mtus.set(id, mtu);
    await BleManager.retrieveServices(id, [ICD001_SERVICE_UUID]);
    await BleManager.startNotification(id, ICD001_SERVICE_UUID, ICD001_TLM_UUID);
    return { mtu };
  }

  async disconnect(id: string): Promise<void> {
    await BleManager.stopNotification(id, ICD001_SERVICE_UUID, ICD001_TLM_UUID).catch(() => undefined);
    await BleManager.disconnect(id).catch(() => undefined);
    this.mtus.delete(id);
  }

  readInfo(id: string): Promise<number[]> {
    return BleManager.read(id, ICD001_SERVICE_UUID, ICD001_INFO_UUID);
  }

  async write(id: string, bytes: number[], withResponse: boolean): Promise<void> {
    const max = Math.max(ICD001_MIN_WRITE_BYTES, (this.mtus.get(id) ?? 23) - 3);
    if (bytes.length > max) {
      // Firmware would treat a split write as two commands; refuse instead.
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
