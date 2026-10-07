/**
 * Manual: ALWAYS the ICD-001 Wings + Pulse cards (same screen, commands, Stop
 * all and auto-STOP as Advanced control). Greyed when disconnected. The Find
 * page "Pleasure House" demo and any legacy BLE link do NOT flip Manual back
 * to the old Current Level + Play slider (Maxwell 2026-10-07).
 *
 * The previous slider UI lived in this file as LegacyManual; removed from the
 * render tree so Manual can never show it. Demo keeps working from Find.
 */
import React from 'react';

import { ManualIcd001 } from './icd001';

export const Manual = () => <ManualIcd001 />;
