import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  COOLED_DOWN_BANNER,
  RhythmCard,
  WingCtx,
  bannerFor,
  beatLabel,
  buildCards,
  callToWire,
  deriveScreenState,
  displayBatteryPct,
  mapAction,
  rhythmPresets,
  rhythmRange,
  runCalls,
  sensorReading,
  sensorSummary,
  tempText,
} from '../../src/screens/advanced-control/model';
import { Icd001Client, Icd001State, LockReason } from '../../src/services/icd001/client';
import { MockIcd001Device, MockIcd001Transport } from '../../src/services/icd001/mock';
import { DeviceInfo, Telemetry, parseInfo, parseTelemetry } from '../../src/services/icd001/protocol';

const LEGACY_INFO = '{"fw":"h11-demo-ble","ver":"1.0","mux":1,"adsA":1,"adsB":0,"imu":1,"ppg":[1,0,1]}';
const V0_INFO =
  '{"proto":"ICD001-0","prod":"ICD-001","hw":"H1.1","fw":"icd001-0.1","mux":1,"adsA":1,"adsB":1,"imu":1,' +
  '"ppg":[1,1,1,1],"ch":{"lra":{"A":"上翼","B":"下翼"},"freq":{"min":100,"max":300,"def":170},' +
  '"vhz":{"min":2,"max":50,"def":10},"lpulse":{"min":50,"max":2000},"ppg":["J13","J22","J23","EGG"],' +
  '"egg":{"ppg":3,"act":0}}}';
const v0 = parseInfo(V0_INFO) as DeviceInfo;
const legacy = parseInfo(LEGACY_INFO) as DeviceInfo;

type Slice = Pick<Icd001State, 'status' | 'estop' | 'overTemp' | 'lowBattery' | 'info' | 'lockReasons'>;
const base: Slice = {
  status: 'connected',
  estop: false,
  overTemp: false,
  lowBattery: false,
  info: v0,
  lockReasons: [],
};
const st = (p: Partial<Slice>): Slice => {
  const s = { ...base, ...p };
  if (!p.lockReasons) {
    const r: LockReason[] = [];
    if (s.status !== 'connected') {
      r.push('disconnected');
    }
    if (s.estop) {
      r.push('estop');
    }
    if (s.overTemp) {
      r.push('overtemp');
    }
    if (s.lowBattery) {
      r.push('lowbat');
    }
    s.lockReasons = r;
  }
  return s;
};

function tlm(p: Record<string, unknown> = {}): Telemetry {
  return parseTelemetry({
    t: 1,
    ppg: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [52000, 1, 72],
    ],
    ntc: 34.2,
    vbat: 3.95,
    lra: [60, 40],
    lp: [
      [0, 0],
      [0, 0],
    ],
    lra_f: 170,
    vhz: 30,
    estop: 0,
    ot: 0,
    lb: 0,
    ...p,
  });
}

describe('state priority 未连接 > 急停 > 过温 > 低电', () => {
  const all = { estop: true, overTemp: true, lowBattery: true };

  it('disconnected wins over everything, no condition lines', () => {
    const s = deriveScreenState(st({ status: 'disconnected', ...all }));
    expect(s).toMatchObject({ kind: 'disconnected', also: [], controlsEnabled: false, connecting: false });
  });

  it('scanning / connecting / reconnecting are disconnected + connecting', () => {
    for (const status of ['scanning', 'connecting', 'reconnecting'] as const) {
      expect(deriveScreenState(st({ status, ...all }))).toMatchObject({
        kind: 'disconnected',
        connecting: true,
      });
    }
  });

  it('estop > overtemp > lowbat, lower ones listed in order', () => {
    expect(deriveScreenState(st(all))).toMatchObject({ kind: 'estop', also: ['overtemp', 'lowbat'] });
    expect(deriveScreenState(st({ overTemp: true, lowBattery: true }))).toMatchObject({
      kind: 'overtemp',
      also: ['lowbat'],
    });
    expect(deriveScreenState(st({ estop: true, lowBattery: true }))).toMatchObject({
      kind: 'estop',
      also: ['lowbat'],
    });
    expect(deriveScreenState(st({ lowBattery: true }))).toMatchObject({ kind: 'lowbat', also: [] });
  });

  it('every pair respects the order', () => {
    const order = ['estop', 'overtemp', 'lowbat'] as const;
    const key = { estop: 'estop', overtemp: 'overTemp', lowbat: 'lowBattery' } as const;
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const s = deriveScreenState(st({ [key[order[i]]]: true, [key[order[j]]]: true }));
        expect(s.kind).toBe(order[i]);
        expect(s.also).toEqual([order[j]]);
      }
    }
  });

  it('normal enables controls; any condition disables them', () => {
    expect(deriveScreenState(st({}))).toMatchObject({ kind: 'normal', controlsEnabled: true });
    for (const p of [{ estop: true }, { overTemp: true }, { lowBattery: true }]) {
      expect(deriveScreenState(st(p)).controlsEnabled).toBe(false);
    }
  });

  it('stale telemetry / missing INFO disables controls without a banner', () => {
    const s = deriveScreenState(st({ lockReasons: ['stale'] }));
    expect(s).toMatchObject({ kind: 'normal', controlsEnabled: false, waiting: true });
    expect(bannerFor(s, null, null)).toBeNull();
    expect(deriveScreenState(st({ info: null, lockReasons: ['noinfo'] })).controlsEnabled).toBe(false);
  });
});

describe('banners', () => {
  it('estop names the source and asks to hold', () => {
    const s = deriveScreenState(st({ estop: true }));
    expect(bannerFor(s, tlm(), 'app')).toEqual({
      tone: 'red',
      icon: 'hand',
      title: 'Emergency stop is on',
      lines: ['All outputs are off. Stopped from the app.', 'Hold the button below to release.'],
    });
    expect(bannerFor(s, tlm(), 'device')?.lines[0]).toBe(
      'All outputs are off. Stopped from the device button.',
    );
  });

  it('overtemp shows the live temperature and the 39 °C release', () => {
    const b = bannerFor(deriveScreenState(st({ overTemp: true })), tlm({ ntc: 42.3, ot: 1 }), null)!;
    expect(b.tone).toBe('amber');
    expect(b.title).toBe('Too warm · 42.3°C');
    expect(b.lines[0]).toBe('Outputs paused to protect your skin. They can start again below 39°C.');
  });

  it('lowbat shows voltage; lower-priority conditions become extra lines', () => {
    const b = bannerFor(deriveScreenState(st({ lowBattery: true })), tlm({ vbat: 3.38, lb: 1 }), null)!;
    expect(b.title).toBe('Battery low · 3.38 V');
    expect(b.lines).toEqual(['Outputs paused. Charge ICD-001 to keep going.']);
    const e = bannerFor(
      deriveScreenState(st({ estop: true, overTemp: true, lowBattery: true })),
      tlm({ ntc: 42.3, vbat: 3.38 }),
      'app',
    )!;
    expect(e.lines.slice(2)).toEqual(['Also too warm (42.3°C).', 'Battery is also low (3.38 V).']);
  });

  it('no banner when normal or disconnected; cooled-down toast copy', () => {
    expect(bannerFor(deriveScreenState(st({})), tlm(), null)).toBeNull();
    expect(bannerFor(deriveScreenState(st({ status: 'disconnected' })), null, null)).toBeNull();
    expect(COOLED_DOWN_BANNER.title).toBe('Cooled down — turn modules back on');
  });
});

describe('device strip values', () => {
  it('battery %: 3.40 V = 0 %, 4.20 V = 100 % (UI default, open question)', () => {
    expect(displayBatteryPct(3.4)).toBe(0);
    expect(displayBatteryPct(3.38)).toBe(0);
    expect(displayBatteryPct(4.2)).toBe(100);
    expect(displayBatteryPct(4.3)).toBe(100);
    expect(displayBatteryPct(3.95)).toBe(69);
    expect(displayBatteryPct(3.8)).toBe(50);
    expect(displayBatteryPct(null)).toBeNull();
  });
  it('temperature text', () => {
    expect(tempText(34.2)).toBe('34.2°C');
    expect(tempText(null)).toBe('—');
  });
});

describe('cards from INFO', () => {
  it('v0: wings (2 groups) + pulse (VHZ capped to 10–50) + bullet (read-only)', () => {
    const cards = buildCards(v0);
    expect(cards.map(c => `${c.id}:${c.kind}`)).toEqual(['wing:intensity', 'vcm:rhythm', 'egg:sensor']);
    const w = cards[0];
    expect(w.kind === 'intensity' && w.groups.map(g => `${g.id}=${g.label}`)).toEqual(['A=上翼', 'B=下翼']);
    const p = cards[1] as RhythmCard;
    expect(p.range).toEqual({ min: 10, max: 50, def: 10 });
    expect(p.device).toEqual({ min: 2, max: 50 });
    expect(cards[2]).toMatchObject({ ppgIndex: 3, hasActuator: false });
  });

  it('legacy H11: VCM 2–20, no bullet card (no ch.egg)', () => {
    const cards = buildCards(legacy);
    expect(cards.map(c => c.id)).toEqual(['wing', 'vcm']);
    expect((cards[1] as RhythmCard).range).toEqual({ min: 2, max: 20, def: 10 });
    expect((cards[1] as RhythmCard).caps.command).toBe('VCM');
  });

  it('no INFO -> no cards', () => {
    expect(buildCards(null)).toEqual([]);
  });

  it('range: a narrow VHZ range inside 10–50 is kept; min/max from INFO', () => {
    expect(rhythmRange({ minHz: 15, maxHz: 30, defaultHz: 20, command: 'VHZ' })).toEqual({
      min: 15,
      max: 30,
      def: 20,
    });
    expect(rhythmRange({ minHz: 2, maxHz: 8, defaultHz: 5, command: 'VHZ' })).toEqual({
      min: 2,
      max: 8,
      def: 5,
    });
  });

  it('presets: 2–20 -> 4/10/18 (design), 10–50 -> 14/30/46', () => {
    expect(rhythmPresets({ min: 2, max: 20, def: 10 })).toEqual({ soft: 4, medium: 10, strong: 18 });
    const p = rhythmPresets({ min: 10, max: 50, def: 10 });
    expect(p).toEqual({ soft: 14, medium: 30, strong: 46 });
    expect(beatLabel(30, p)).toBe('Medium');
    expect(beatLabel(12, p)).toBe('Soft');
    expect(beatLabel(50, p)).toBe('Strong');
  });

  it('sensor summary', () => {
    const egg = buildCards(v0)[2];
    if (egg.kind !== 'sensor') {
      throw new Error('expected sensor');
    }
    expect(sensorSummary(sensorReading(tlm(), egg))).toEqual({ strong: 'On skin', rest: ' · 72 bpm' });
    const noContact = tlm({
      ppg: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [900, 0, 0],
      ],
    });
    expect(sensorSummary(sensorReading(noContact, egg)).strong).toBe('Not detected');
    expect(sensorSummary(sensorReading(null, egg)).rest).toBe('No sensor data');
  });
});

describe('control -> command mapping (wire text per PROTOCOL §7)', () => {
  const cards = buildCards(v0);
  const pulse = cards[1] as RhythmCard;
  const wing: WingCtx = {
    link: false,
    mode: 'steady',
    rhythm: 'medium',
    values: { A: 60, B: 40 },
    freq: 170,
    groups: ['A', 'B'],
    freqRange: { min: 100, max: 300 },
  };
  const wire = (a: Parameters<typeof mapAction>[0], w: WingCtx = wing, info: DeviceInfo = v0) =>
    mapAction(a, { wing: w, pulse: buildCards(info)[1] as RhythmCard }).map(c => callToWire(c, info));

  it('wing slider per group -> LRA 0|1 v', () => {
    expect(wire({ t: 'wingSlider', group: 'A', value: 60 })).toEqual(['LRA 0 60']);
    expect(wire({ t: 'wingSlider', group: 'B', value: 40.4 })).toEqual(['LRA 1 40']);
    expect(wire({ t: 'wingSlider', group: 'A', value: 140 })).toEqual(['LRA 0 100']);
  });

  it('linked slider -> LRA BOTH (ALL = both groups)', () => {
    expect(wire({ t: 'wingSlider', group: 'B', value: 55 }, { ...wing, link: true })).toEqual([
      'LRA BOTH 55',
    ]);
  });

  it('switch off -> LRA BOTH 0; on -> restores last A/B', () => {
    expect(wire({ t: 'wingSwitch', on: false })).toEqual(['LRA BOTH 0']);
    expect(wire({ t: 'wingSwitch', on: true })).toEqual(['LRA 0 60', 'LRA 1 40']);
    expect(wire({ t: 'wingSwitch', on: true }, { ...wing, values: { A: 50, B: 50 } })).toEqual([
      'LRA BOTH 50',
    ]);
  });

  it('rhythm mode -> LPULSE t v on off; back to steady -> LRA', () => {
    const r: WingCtx = { ...wing, mode: 'rhythm' };
    expect(wire({ t: 'wingSlider', group: 'A', value: 70 }, r)).toEqual(['LPULSE 0 70 400 400']);
    expect(wire({ t: 'wingRhythm', preset: 'fast' })).toEqual(['LPULSE 0 60 150 150', 'LPULSE 1 40 150 150']);
    expect(wire({ t: 'wingMode', mode: 'steady' }, r)).toEqual(['LRA 0 60', 'LRA 1 40']);
    expect(wire({ t: 'wingMode', mode: 'rhythm' }, { ...wing, values: { A: 0, B: 0 } })).toEqual([]);
    expect(wire({ t: 'wingSlider', group: 'A', value: 0 }, r)).toEqual(['LRA 0 0']);
  });

  it('freq stepper ±5 -> FREQ, clamped to INFO range', () => {
    expect(wire({ t: 'freqStep', delta: 5 })).toEqual(['FREQ 175']);
    expect(wire({ t: 'freqStep', delta: -5 }, { ...wing, freq: 100 })).toEqual(['FREQ 100']);
    expect(wire({ t: 'freqStep', delta: 5 }, { ...wing, freq: 300 })).toEqual(['FREQ 300']);
  });

  it('pulse slider/preset -> VHZ hz within 10–50; switch off -> VHZ 0', () => {
    expect(wire({ t: 'pulseSlider', hz: 30 })).toEqual(['VHZ 30']);
    expect(wire({ t: 'pulseSlider', hz: 4 })).toEqual(['VHZ 10']);
    expect(wire({ t: 'pulseSlider', hz: 80 })).toEqual(['VHZ 50']);
    expect(wire({ t: 'pulsePreset', hz: 46 })).toEqual(['VHZ 46']);
    expect(wire({ t: 'pulseSwitch', on: false, lastHz: 30 })).toEqual(['VHZ 0']);
    expect(wire({ t: 'pulseSwitch', on: true, lastHz: 30 })).toEqual(['VHZ 30']);
    expect(wire({ t: 'pulseSwitch', on: true, lastHz: 0 })).toEqual(['VHZ 10']);
    expect(pulse.range.max).toBe(50);
  });

  it('legacy board -> VCM on halfMs (2–20 Hz)', () => {
    expect(wire({ t: 'pulseSlider', hz: 10 }, wing, legacy)).toEqual(['VCM 1 50']);
    expect(wire({ t: 'pulseSlider', hz: 40 }, wing, legacy)).toEqual(['VCM 1 25']);
    expect(wire({ t: 'pulseSwitch', on: false, lastHz: 10 }, wing, legacy)).toEqual(['VCM 0']);
  });

  it('safety: STOP ALL -> ESTOP 1, release -> ESTOP 0, leaving -> STOP', () => {
    expect(wire({ t: 'stopAll' })).toEqual(['ESTOP 1']);
    expect(wire({ t: 'release' })).toEqual(['ESTOP 0']);
    expect(wire({ t: 'leave' })).toEqual(['STOP']);
  });
});

describe('mapping through the real client + simulator (throttle, latest wins)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 7_000_000 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  const tick = async (ms: number) => {
    for (let i = 0; i < ms; i += 10) {
      await jest.advanceTimersByTimeAsync(10);
    }
  };

  it('a slider drag of 50 moves sends ≤ ~10/s and lands on the final value', async () => {
    const dev = new MockIcd001Device('icd1', 'ICD1-TEST');
    const client = new Icd001Client(new MockIcd001Transport([dev], { mtu: 185, connectDelayMs: 10 }));
    const p = client.connect({ id: 'sim-ICD1-TEST', name: dev.name, rssi: -50, kind: null, simulated: true });
    await tick(300);
    expect(await p).toBe(true);
    const cards = buildCards(client.getState().info);
    const wing: WingCtx = {
      link: false,
      mode: 'steady',
      rhythm: 'medium',
      values: { A: 0, B: 0 },
      freq: 170,
      groups: ['A', 'B'],
      freqRange: { min: 100, max: 300 },
    };
    dev.commandLog.length = 0;
    for (let i = 1; i <= 50; i++) {
      runCalls(client, mapAction({ t: 'wingSlider', group: 'A', value: i * 2 }, { wing }));
      await tick(20); // 50 events over 1 s
    }
    for (let hz = 10; hz <= 50; hz += 2) {
      runCalls(client, mapAction({ t: 'pulseSlider', hz }, { pulse: cards[1] as RhythmCard }));
    }
    await tick(400);
    const lra = dev.commandLog.filter(c => c.startsWith('LRA 0'));
    expect(lra.length).toBeLessThanOrEqual(12);
    expect(lra[lra.length - 1]).toBe('LRA 0 100');
    const vhz = dev.commandLog.filter(c => c.startsWith('VHZ'));
    expect(vhz[vhz.length - 1]).toBe('VHZ 50');
    expect(vhz.length).toBeLessThanOrEqual(2);
    expect(dev.snapshot()).toMatchObject({ lra: [100, 0], vcmOn: true, vcmHz: 50 });

    runCalls(client, mapAction({ t: 'stopAll' }, {}));
    await tick(200);
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'app' });
    expect(deriveScreenState(client.getState()).kind).toBe('estop');
    runCalls(client, mapAction({ t: 'release' }, {}));
    await tick(200);
    expect(client.getState()).toMatchObject({ estop: false, estopSource: null });
    client.destroy();
  });
});
