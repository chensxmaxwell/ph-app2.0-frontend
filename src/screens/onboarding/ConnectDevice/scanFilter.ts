/**
 * Which BLE peripherals "Find your device" lists.
 *
 * The page's scanner (legacy `useBleManager`) scans with no service filter, so
 * the OS reports every advertiser nearby: phones, watches, Macs, appliances,
 * ESP32 sample sketches and lots of nameless beacons. Only our own hardware is
 * listed here: named ICD-001 products (ICD1-XXXX) and H1.1 dev boards
 * (H11-XXXX), plus any legacy product prefix added to LEGACY_DEVICE_NAME_PREFIXES.
 */
import { DeviceKind, ICD001_NAME_PREFIXES, classifyDeviceName } from '../../../services/icd001/protocol';

import type { PeripheralWrapper } from '../../../hooks/useBleManager';

/** ICD-001 product + H1.1 dev board (same prefixes the ICD-001 client accepts). */
export const ICD001_LIST_PREFIXES: readonly string[] = [
  ICD001_NAME_PREFIXES.product,
  ICD001_NAME_PREFIXES.devboard,
];

/**
 * Pre-ICD-001 products that still use the legacy (Nordic UART) path on this
 * page. Empty: no legacy product name is known in the code or history. Add the
 * prefix here if an older product must be listed again.
 */
export const LEGACY_DEVICE_NAME_PREFIXES: readonly string[] = [];

export const FIND_DEVICE_NAME_PREFIXES: readonly string[] = [
  ...ICD001_LIST_PREFIXES,
  ...LEGACY_DEVICE_NAME_PREFIXES,
];

/** Advertised local name first (scan response), then the GAP name; trimmed. */
export function peripheralName(p: {
  name?: string | null;
  advertising?: { localName?: string | null } | null;
}): string {
  return (p.advertising?.localName || p.name || '').trim();
}

export function isListedDeviceName(
  name: string,
  prefixes: readonly string[] = FIND_DEVICE_NAME_PREFIXES,
): boolean {
  const n = name.trim().toUpperCase();
  return n.length > 0 && prefixes.some(pre => n.startsWith(pre.toUpperCase()));
}

/** ICD-001 product / dev board -> connect through the ICD-001 client. */
export function icd001Kind(p: PeripheralWrapper['peripheral']): DeviceKind | null {
  return classifyDeviceName(peripheralName(p));
}

/**
 * Hide blank and non-product names, keep one row per device id (the latest
 * report, `connected` kept if any report had it), strongest signal first.
 */
export function filterFoundDevices(
  list: readonly PeripheralWrapper[],
  prefixes: readonly string[] = FIND_DEVICE_NAME_PREFIXES,
): PeripheralWrapper[] {
  const byId = new Map<string, PeripheralWrapper>();
  for (const w of list) {
    if (!w?.peripheral?.id || !isListedDeviceName(peripheralName(w.peripheral), prefixes)) {
      continue;
    }
    const prev = byId.get(w.peripheral.id);
    byId.set(w.peripheral.id, prev && prev.connected && !w.connected ? { ...w, connected: true } : w);
  }
  const rssi = (w: PeripheralWrapper) => (typeof w.peripheral.rssi === 'number' ? w.peripheral.rssi : -999);
  return [...byId.values()].sort(
    (a, b) => rssi(b) - rssi(a) || peripheralName(a.peripheral).localeCompare(peripheralName(b.peripheral)),
  );
}
