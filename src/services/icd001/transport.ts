/**
 * Transport abstraction so the client runs against real BLE
 * (react-native-ble-manager) or the in-app simulator.
 */
import type { ConnectStep } from './connectSteps';
import type { DeviceKind } from './protocol';

export interface DiscoveredDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  kind: DeviceKind | null;
  simulated?: boolean;
}

export interface ConnectResult {
  /** Negotiated ATT MTU (23 if unknown). */
  mtu: number;
}

export interface Icd001Transport {
  readonly kind: 'ble' | 'mock';
  /** Permissions + adapter start. Throws with a user-readable message on failure. */
  init(): Promise<void>;
  startScan(onDevice: (d: DiscoveredDevice) => void, timeoutMs: number): Promise<void>;
  stopScan(): Promise<void>;
  /**
   * Connect, request MTU, discover services, enable TLM notifications. Each
   * native step is bounded (connectSteps.ts) and reported via `onStep`; throws
   * ConnectStepError (kind 'unsupported' when the ICD-001 service is missing).
   */
  connect(id: string, onStep?: (s: ConnectStep) => void): Promise<ConnectResult>;
  disconnect(id: string): Promise<void>;
  /** Read INFO characteristic raw bytes. */
  readInfo(id: string): Promise<number[]>;
  /**
   * Write one command (UTF-8, `\n`-terminated) to CMD. `allowSplit` = the
   * firmware buffers until `\n` (v0), so the bytes may span several ATT writes.
   */
  write(id: string, bytes: number[], withResponse: boolean, allowSplit: boolean): Promise<void>;
  onNotify(cb: (id: string, bytes: number[]) => void): () => void;
  onDisconnected(cb: (id: string) => void): () => void;
}
