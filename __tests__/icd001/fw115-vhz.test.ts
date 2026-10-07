/**
 * h11-icd-v1 1.1.5 (PROTOCOL-ICD001 §11.11, Maxwell 2026-10-07): manual VHZ is
 * `0` or an integer 1–30; 31–50 / negative -> `ERR RANGE VHZ`; decimals
 * (0.5 / 1.0 / 30.0 / 1e1) -> `ERR ARG VHZ`. INFO ch.vhz = {min:1,max:30,def:10},
 * ch.auto.vhz still 1–15. A new Hz applies only after the current full cycle,
 * so the app throttles VHZ while dragging (VCM_SEND_INTERVAL_MS) and always
 * sends the final value; `VHZ 0` skips the wait.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { RhythmCard, buildCards, callToWire, mapAction } from '../../src/screens/advanced-control/model';
import { Icd001Client, VCM_SEND_INTERVAL_MS } from '../../src/services/icd001/client';
import { MockIcd001Device, MockIcd001Transport } from '../../src/services/icd001/mock';
import { DeviceInfo, formatVcmHz, parseInfo } from '../../src/services/icd001/protocol';

const tick = async (ms: number) => {
  for (let i = 0; i < ms; i += 10) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

/** Exact ch block of a fw 1.1.5 INFO (other fields as 1.1.4). */
const FW115_INFO = JSON.stringify({
  proto: 'ICD001-1',
  prod: 'ICD-001',
  hw: 'H1.1',
  fw: '1.1.5',
  mux: 1,
  adsA: 1,
  adsB: 1,
  imu: 1,
  ppg: [1, 1, 1],
  ch: {
    lra: { A: '上翼', B: '下翼' },
    freq: { min: 100, max: 300, def: 170 },
    vhz: { min: 1, max: 30, def: 10 },
    lpulse: { min: 50, max: 2000 },
    ppg: ['J13', 'J22', 'J23'],
    egg: { ppg: -1, act: 0 },
    mode: ['manual', 'auto'],
    auto: { vhz: { min: 1, max: 15 }, press: { on: 80, off: 50, full: 2400 }, hr: { lo: 60, hi: 120 }, lraNoHr: 0 },
  },
});
const INT_VHZ = /^VHZ (0|[1-9]\d*)$/;

describe('fw 1.1.5 INFO: Pulse slider is exactly 1..30 Hz, integer VHZ only', () => {
  const info = parseInfo(FW115_INFO) as DeviceInfo;
  const pulse = buildCards(info).find(c => c.id === 'vcm') as RhythmCard;

  it('INFO ch.vhz 1–30 -> slider range 1–30 (def 10), auto range untouched', () => {
    expect(info.modules.vcm).toMatchObject({ minHz: 1, maxHz: 30, defaultHz: 10, command: 'VHZ' });
    expect(pulse.range).toEqual({ min: 1, max: 30, def: 10 });
    expect(pulse.device).toEqual({ min: 1, max: 30 });
    expect(info.auto?.vhz).toEqual({ min: 1, max: 15 });
  });

  it('every slider stop 1..30 sends exactly `VHZ n`', () => {
    const sent: string[] = [];
    for (let hz = 1; hz <= 30; hz++) {
      mapAction({ t: 'pulseSlider', hz }, { pulse }).forEach(c => sent.push(callToWire(c, info)));
    }
    expect(sent).toEqual(Array.from({ length: 30 }, (_, i) => `VHZ ${i + 1}`));
  });

  it('fractional / out-of-range input is rounded and clamped before send (never `1.0`, `0.5`, 31+)', () => {
    const caps = info.modules.vcm!;
    const cases: Array<[number, string]> = [
      [0.5, 'VHZ 1'], // > 0 = on: lowest speed, not off, not `VHZ 0.5`
      [1.0, 'VHZ 1'],
      [1.49, 'VHZ 1'],
      [1.5, 'VHZ 2'],
      [29.6, 'VHZ 30'],
      [30.0, 'VHZ 30'],
      [30.4, 'VHZ 30'],
      [31, 'VHZ 30'],
      [50, 'VHZ 30'],
      [0, 'VHZ 0'],
      [-1, 'VHZ 0'],
      [NaN, 'VHZ 0'],
    ];
    for (const [hz, wire] of cases) {
      const line = formatVcmHz(hz, caps);
      expect(line).toBe(wire);
      expect(line).toMatch(INT_VHZ);
    }
    // through the UI mapping too (slider value may be fractional while dragging)
    for (const hz of [0.7, 7.3, 12.5, 29.99]) {
      const [c] = mapAction({ t: 'pulseSlider', hz }, { pulse });
      expect(callToWire(c, info)).toMatch(INT_VHZ);
    }
    expect(callToWire(mapAction({ t: 'pulseSwitch', on: true, lastHz: 42 }, { pulse })[0], info)).toBe('VHZ 30');
  });
});

describe('mock firmware = fw 1.1.5 manual VHZ rules (§11.11)', () => {
  const manualDev = () => {
    const dev = new MockIcd001Device('icd1v1', 'ICD1-F115', () => 0);
    expect(dev.handleWrite('MODE MANUAL')[0]).toMatch(/^OK MODE MANUAL/);
    return dev;
  };

  it('INFO reports ch.vhz {1,30,10}, fw 1.1.5, auto 1–15 unchanged', () => {
    const info = JSON.parse(new MockIcd001Device('icd1v1', 'ICD1-F115').infoJson(true));
    expect(info.fw).toContain('1.1.5');
    expect(info.ch.vhz).toEqual({ min: 1, max: 30, def: 10 });
  });

  it('VHZ 0 | 1–30 -> OK VHZ n', () => {
    const dev = manualDev();
    for (const n of [1, 2, 10, 29, 30, 0]) {
      expect(dev.handleWrite(`VHZ ${n}`)).toEqual([`OK VHZ ${n}`]);
    }
  });

  it('31–50 / negative -> ERR RANGE VHZ; decimals -> ERR ARG VHZ; running Hz unchanged', () => {
    const dev = manualDev();
    expect(dev.handleWrite('VHZ 12')).toEqual(['OK VHZ 12']);
    for (const bad of ['31', '40', '50', '51', '99', '-1']) {
      expect(dev.handleWrite(`VHZ ${bad}`)).toEqual(['ERR RANGE VHZ']);
    }
    for (const bad of ['0.5', '1.0', '1.5', '30.0', '1e1']) {
      expect(dev.handleWrite(`VHZ ${bad}`)).toEqual(['ERR ARG VHZ']);
    }
    expect(dev.snapshot()).toMatchObject({ vcmOn: true, vcmHz: 12 });
  });

  it('older fw (1.1.0–1.1.4) can still be emulated: 2–50', () => {
    const dev = manualDev();
    dev.manualVhz = { min: 2, max: 50, def: 10 };
    expect(dev.handleWrite('VHZ 1')).toEqual(['ERR RANGE VHZ']);
    expect(dev.handleWrite('VHZ 50')).toEqual(['OK VHZ 50']);
    expect(JSON.parse(dev.infoJson(true)).ch.vhz).toEqual({ min: 2, max: 50, def: 10 });
  });
});

describe('client on the fw 1.1.5 mock: throttled drag, final value, immediate off, ERR handled', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 9_000_000 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const setup = async () => {
    const dev = new MockIcd001Device('icd1v1', 'ICD1-F115');
    const client = new Icd001Client(new MockIcd001Transport([dev], { mtu: 185, connectDelayMs: 10 }));
    const p = client.connect({ id: 'sim-ICD1-F115', name: dev.name, rssi: -50, kind: null, simulated: true });
    await tick(400);
    expect(await p).toBe(true);
    expect(client.getState().info?.modules.vcm).toMatchObject({ minHz: 1, maxHz: 30 });
    client.setMode('manual');
    await tick(300);
    expect(dev.mode).toBe('manual');
    // record when each VHZ reached the device
    const vhzAt: Array<[number, string]> = [];
    const orig = dev.handleWrite.bind(dev);
    dev.handleWrite = (text: string) => {
      text
        .split(/[\n;]/)
        .map(x => x.trim())
        .filter(x => x.startsWith('VHZ'))
        .forEach(x => vhzAt.push([Date.now(), x]));
      return orig(text);
    };
    return { dev, client, vhzAt, done: () => client.destroy() };
  };

  it(`a 1→30 drag (10 ms steps) is throttled to ≥ ${VCM_SEND_INTERVAL_MS} ms apart, integer only, final value 30`, async () => {
    const t = await setup();
    for (let hz = 1; hz <= 30; hz++) {
      t.client.setVcmHz(hz + 0.3); // fractional slider positions
      await tick(10);
    }
    await tick(500);
    const lines = t.vhzAt.map(x => x[1]);
    expect(lines.every(l => INT_VHZ.test(l))).toBe(true);
    expect(lines[lines.length - 1]).toBe('VHZ 30');
    expect(lines.length).toBeLessThanOrEqual(3); // 300 ms drag at ≤ 5/s
    for (let i = 1; i < t.vhzAt.length; i++) {
      expect(t.vhzAt[i][0] - t.vhzAt[i - 1][0]).toBeGreaterThanOrEqual(VCM_SEND_INTERVAL_MS);
    }
    expect(t.dev.snapshot()).toMatchObject({ vcmOn: true, vcmHz: 30 });
    t.done();
  });

  it('VHZ 0 right after a send is not held back by the throttle', async () => {
    const t = await setup();
    t.client.setVcmHz(5);
    await tick(20);
    expect(t.vhzAt.map(x => x[1])).toEqual(['VHZ 5']);
    const sentAt = t.vhzAt[0][0];
    t.client.setVcmHz(0);
    await tick(100);
    expect(t.vhzAt.map(x => x[1])).toEqual(['VHZ 5', 'VHZ 0']);
    expect(t.vhzAt[1][0] - sentAt).toBeLessThan(VCM_SEND_INTERVAL_MS);
    expect(t.dev.snapshot()).toMatchObject({ vcmOn: false });
    t.done();
  });

  it('ERR RANGE VHZ / ERR ARG VHZ: recorded, no safety lock, link stays up, next value still sent', async () => {
    const t = await setup();
    // device narrower than the INFO the app read (e.g. stale INFO): app sends 30, fw refuses
    t.dev.manualVhz = { min: 1, max: 20, def: 10 };
    t.client.setVcmHz(30);
    await tick(300);
    let s = t.client.getState();
    expect(t.vhzAt.map(x => x[1])).toContain('VHZ 30');
    expect(s.lastErrInfo).toMatchObject({ reason: 'RANGE', verb: 'VHZ' });
    expect(s).toMatchObject({ status: 'connected', estop: false, overTemp: false, lowBattery: false });
    expect(s.lockReasons ?? []).toEqual([]);
    // decimals are never produced by the app; a stray ERR ARG VHZ is handled the same way
    t.client.onLine('ERR ARG VHZ');
    s = t.client.getState();
    expect(s.lastErrInfo).toMatchObject({ reason: 'ARG', verb: 'VHZ' });
    expect(s).toMatchObject({ status: 'connected', estop: false });
    // dedupe was reset by the ERR: the same / next value goes out again
    t.dev.manualVhz = { min: 1, max: 30, def: 10 };
    t.client.setVcmHz(30);
    await tick(400);
    expect(t.vhzAt.filter(x => x[1] === 'VHZ 30').length).toBe(2);
    expect(t.dev.snapshot()).toMatchObject({ vcmOn: true, vcmHz: 30 });
    t.done();
  });
});
