/**
 * Manual page, ICD-001 part (Maxwell 2026-10-06: put the wings and pulse
 * controls into Manual; 2026-10-07: Manual ALWAYS shows this UI).
 *
 * Renders the Advanced control screen (Wings card, Pulse & Bullet card,
 * notices, Stop all dock, STOP on leave) titled "Manual". Cards stay visible
 * (greyed) when nothing is connected. The old Current Level + Play slider is
 * never shown here — not for the Find-page "Pleasure House" demo row, and not
 * for a legacy BLE link. Demo / legacy devices keep working from Find; Manual
 * stays the ICD-001 cards.
 */
import React from 'react';

import { AdvancedControlScreen } from '../../../advanced-control';

/** Always ICD-001 cards (placeholder when disconnected). Kept for tests / call sites. */
export type ManualMode = 'icd001';

/** Always 'icd001'. Args kept so older tests / call sites still type-check. */
export function manualModeFor(_icd?: unknown, _legacyConnected?: boolean): ManualMode {
  return 'icd001';
}

export function useManualMode(): ManualMode {
  return 'icd001';
}

/** Cards are shown (disabled) even before the first connect, so Manual always has Wings + Pulse. */
export const ManualIcd001 = () => <AdvancedControlScreen title="Manual" placeholderCards />;
