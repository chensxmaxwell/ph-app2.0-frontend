/**
 * View model for "Find your device": filtered scan list (scanFilter.ts),
 * ICD-001 rows routed to the shared ICD-001 client (same session as Advanced
 * control), pill text, empty state.
 */
import { useState } from 'react';

import { batteryPercent, DiscoveredDevice, useIcd001 } from '../../../services/icd001';

import { filterFoundDevices, icd001Kind, peripheralName } from './scanFilter';

import type { PeripheralWrapper } from '../../../hooks/useBleManager';

export interface FindDevicesInput {
  bleDevice: PeripheralWrapper[] | undefined;
  scaning: boolean;
  startScan: () => unknown;
  stopScan: () => unknown;
  legacyConnected: boolean;
  demoConnected: boolean;
  demoConnecting: boolean;
  demoBattery: number;
}

export function useFindDevices(i: FindDevicesInput) {
  const { state: icd, client } = useIcd001();
  const [searched, setSearched] = useState(false);
  const icdConnected = icd.status === 'connected' && !!icd.device;
  const connectedId = icdConnected ? icd.device?.id : undefined;

  // Only our hardware (ICD1- / H11- names), one row per id, strongest first.
  const found: PeripheralWrapper[] = filterFoundDevices(i.bleDevice ?? []).map(w =>
    icd001Kind(w.peripheral) ? { ...w, connected: w.peripheral.id === connectedId } : w,
  );
  // A device connected through the ICD-001 client stays listed when there is no scan list.
  if (icdConnected && icd.device && !found.some(w => w.peripheral.id === connectedId)) {
    found.unshift({
      peripheral: {
        id: icd.device.id,
        name: icd.device.name ?? '',
        rssi: icd.device.rssi ?? -60,
        advertising: {},
      } as PeripheralWrapper['peripheral'],
      connected: true,
    });
  }

  const linked = i.legacyConnected || i.demoConnected || icdConnected;
  const icdBattery = icdConnected ? batteryPercent(icd.tlm?.vbat ?? null) : null;
  let batteryText = '--';
  if (linked) {
    if (icdConnected && !i.demoConnected) {
      batteryText = icdBattery === null ? '--' : `${icdBattery}%`;
    } else {
      batteryText = `${i.demoBattery}%`;
    }
  }
  let statusText = linked ? 'Connected' : 'Disconnected';
  if (i.demoConnecting || icd.status === 'connecting' || icd.status === 'reconnecting') {
    statusText = 'Connecting...';
  }
  // Failed connect (timeout / Bluetooth off / firmware): two-line notice + Retry; the pill reads Disconnected.
  const failure =
    !linked && (icd.status === 'error' || icd.status === 'disconnected') && icd.connectFailure
      ? { title: icd.connectFailure.title, line: icd.connectFailure.line }
      : null;
  const retry = () => {
    if (i.scaning) {
      i.stopScan();
    }
    client.retry().catch(() => undefined);
  };
  let emptyText: string | null = null;
  if (found.length === 0) {
    // After a scan (Refresh tapped, or the scanner reported anything at all) and nothing of ours.
    const scanned = searched || (i.bleDevice?.length ?? 0) > 0;
    emptyText = i.scaning ? 'Searching…' : scanned ? 'No device found. Tap Refresh.' : null;
  }

  const refresh = () => {
    if (!i.scaning) {
      setSearched(true);
      i.startScan();
    }
  };

  /** true when the row was an ICD-001 device and has been handled. */
  const connectIcd001 = (w: PeripheralWrapper): boolean => {
    const kind = icd001Kind(w.peripheral);
    if (!kind) {
      return false;
    }
    const device: DiscoveredDevice = {
      id: w.peripheral.id,
      name: peripheralName(w.peripheral),
      rssi: w.peripheral.rssi ?? null,
      kind,
    };
    if (i.scaning) {
      i.stopScan();
    }
    client.connect(device).catch(() => undefined);
    return true;
  };

  const disconnectIcd001 = (w: PeripheralWrapper): boolean => {
    if (!icd001Kind(w.peripheral)) {
      return false;
    }
    client.disconnect().catch(() => undefined);
    return true;
  };

  return {
    found,
    linked,
    statusText,
    batteryText,
    emptyText,
    failure,
    retry,
    refresh,
    connectIcd001,
    disconnectIcd001,
  };
}
