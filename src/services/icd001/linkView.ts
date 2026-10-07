/**
 * One shared Bluetooth connection view for every page (Home / Control pill,
 * Find your device, Manual, Advanced, Auto bar). Driven only by the ICD-001
 * client — never by the old "Pleasure House" demo row or a legacy BLE flag.
 */
import { batteryPercent } from './protocol';

import type { ConnStatus, Icd001State } from './client';
import type { ConnectFailure } from './connectSteps';

export type LinkLabel = 'Disconnected' | 'Connecting...' | 'Connected';

export interface LinkView {
  /** Real ICD-001 / H11 session up. */
  connected: boolean;
  /** Connecting or reconnecting. */
  connecting: boolean;
  status: ConnStatus;
  /** Pill / Find header label. */
  label: LinkLabel;
  /** Battery % from TLM vbat, or null when unknown / not connected. */
  batteryPct: number | null;
  /** "85%" or "--". */
  batteryText: string;
  /** Failed connect notice (timeout / Bluetooth off / firmware), when not linked. */
  failure: { title: string; line: string } | null;
}

export function linkViewFromState(
  s: Pick<Icd001State, 'status' | 'device' | 'tlm' | 'connectFailure'>,
): LinkView {
  const connected = s.status === 'connected' && !!s.device;
  const connecting = s.status === 'connecting' || s.status === 'reconnecting';
  const batteryPct = connected ? batteryPercent(s.tlm?.vbat ?? null) : null;
  let label: LinkLabel = 'Disconnected';
  if (connecting) {
    label = 'Connecting...';
  } else if (connected) {
    label = 'Connected';
  }
  const failure: ConnectFailure | null =
    !connected && !connecting && (s.status === 'error' || s.status === 'disconnected')
      ? s.connectFailure
      : null;
  return {
    connected,
    connecting,
    status: s.status,
    label,
    batteryPct,
    batteryText: batteryPct === null ? '--' : `${batteryPct}%`,
    failure: failure ? { title: failure.title, line: failure.line } : null,
  };
}
