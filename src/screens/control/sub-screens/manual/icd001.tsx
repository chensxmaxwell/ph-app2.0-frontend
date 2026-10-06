/**
 * Manual page, ICD-001 part (Maxwell 2026-10-06: put the wings and pulse
 * controls into Manual). Renders the Advanced control screen (Wings card,
 * Pulse & Bullet card, notices, Stop all dock, STOP on leave) titled "Manual".
 *
 * Which Manual is shown (manualModeFor):
 *  1. an ICD-001 / H1.1 session (connected, connecting, reconnecting) -> ICD-001 cards;
 *  2. otherwise a legacy BLE or demo device connected -> original level slider;
 *  3. otherwise (nothing connected) -> ICD-001 cards in the "Not connected" state.
 */
import React from 'react';

import { useHomeScreen } from '../../../../hooks/HomeScreenContext';
import { classifyDeviceName, useIcd001 } from '../../../../services/icd001';
import { AdvancedControlScreen } from '../../../advanced-control';

import type { ConnStatus, DiscoveredDevice } from '../../../../services/icd001';

export type ManualMode = 'icd001' | 'legacy';

const SESSION: ReadonlyArray<ConnStatus> = ['connected', 'connecting', 'reconnecting'];

export function manualModeFor(
  icd: { status: ConnStatus; device: DiscoveredDevice | null },
  legacyConnected: boolean,
): ManualMode {
  const icdSession =
    !!icd.device && SESSION.includes(icd.status) && classifyDeviceName(icd.device.name) !== null;
  if (icdSession) {
    return 'icd001';
  }
  return legacyConnected ? 'legacy' : 'icd001';
}

export function useManualMode(): ManualMode {
  const { state } = useIcd001();
  const { isConnected } = useHomeScreen() as { isConnected?: boolean };
  return manualModeFor(state, !!isConnected);
}

/** Cards are shown (disabled) even before the first connect, so Manual always has Wings + Pulse. */
export const ManualIcd001 = () => <AdvancedControlScreen title="Manual" placeholderCards />;
