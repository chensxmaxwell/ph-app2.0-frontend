import { describe, expect, it } from '@jest/globals';

import { linkViewFromState } from '../../src/services/icd001/linkView';

import type { Icd001State } from '../../src/services/icd001/client';

const base = {
  status: 'idle',
  device: null,
  tlm: null,
  connectFailure: null,
} as unknown as Pick<Icd001State, 'status' | 'device' | 'tlm' | 'connectFailure'>;

describe('linkViewFromState (shared BLE status)', () => {
  it('idle / disconnected → Disconnected, no fake battery', () => {
    expect(linkViewFromState(base)).toMatchObject({
      connected: false,
      connecting: false,
      label: 'Disconnected',
      batteryText: '--',
      failure: null,
    });
  });

  it('connecting / reconnecting → Connecting...', () => {
    expect(linkViewFromState({ ...base, status: 'connecting' }).label).toBe('Connecting...');
    expect(linkViewFromState({ ...base, status: 'reconnecting' }).connecting).toBe(true);
  });

  it('connected with vbat → Connected + %', () => {
    const v = linkViewFromState({
      ...base,
      status: 'connected',
      device: { id: 'x', name: 'H11-91B1', rssi: -50, kind: 'devboard' },
      tlm: { vbat: 4.05 } as Icd001State['tlm'],
    });
    expect(v.connected).toBe(true);
    expect(v.label).toBe('Connected');
    expect(v.batteryPct).not.toBeNull();
    expect(v.batteryText).toMatch(/%$/);
  });

  it('error with connectFailure → Disconnected + failure notice', () => {
    const v = linkViewFromState({
      ...base,
      status: 'error',
      connectFailure: {
        kind: 'timeout',
        step: 'link',
        title: "Couldn't connect",
        line: 'No answer. Keep it close, tap Retry.',
        detail: 'x',
        at: 1,
      },
    });
    expect(v.label).toBe('Disconnected');
    expect(v.failure).toEqual({
      title: "Couldn't connect",
      line: 'No answer. Keep it close, tap Retry.',
    });
  });
});
