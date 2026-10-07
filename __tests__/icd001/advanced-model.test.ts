import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  BannerModel,
  COOLED_DOWN_BANNER,
  RELEASED_ON_DEVICE_BANNER,
  UNLOCK_LINE,
  HOTSPOT_ZONES,
  PLACEHOLDER_INFO,
  VHZ_UI_MAX,
  VHZ_UI_MIN,
  clampPulseTarget,
  RhythmCard,
  WING_FREQ_HZ,
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
  wingFreqCorrection,
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
/** INFO safety with ch.ot trip 42 / clear 39 from the device (fixture V0_INFO has no ch.ot). */
const safetyWithOt = (trip = 42, clear = 39) => {
  const raw = JSON.parse(V0_INFO);
  raw.ch.ot = { trip, clear };
  return parseInfo(raw)!.safety;
};
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
    f: 170,
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

describe('notices (design v4 copy): always exactly two lines (title + one line)', () => {
  it('estop: title by source, second line always "Tap Unlock when you are ready."', () => {
    const s = deriveScreenState(st({ estop: true }));
    expect(bannerFor(s, tlm(), 'app')).toEqual({
      tone: 'neutral',
      icon: 'lock',
      title: 'Everything is stopped',
      line: 'Tap Unlock when you are ready.',
    });
    expect(bannerFor(s, tlm(), null)).toMatchObject({ title: 'Everything is stopped', line: UNLOCK_LINE });
    // §10.1 latch seen only in TLM, not set by this app
    expect(bannerFor(s, tlm(), 'unknown')).toMatchObject({
      title: 'Stop all is still on',
      line: UNLOCK_LINE,
    });
    // EVT ESTOP from the START key on this connection
    expect(bannerFor(s, tlm(), 'device')).toMatchObject({
      title: 'Stopped with the device button',
      line: UNLOCK_LINE,
    });
    expect(JSON.stringify(bannerFor(s, tlm(), 'app'))).not.toContain('All outputs are off');
  });

  it('overtemp: one line with the live reading and the device clear value (INFO ch.ot)', () => {
    const b = bannerFor(
      deriveScreenState(st({ overTemp: true })),
      tlm({ ntc: 42.6, ot: 1 }),
      null,
      safetyWithOt(),
    )!;
    expect(b).toEqual({
      tone: 'warn',
      icon: 'thermometer',
      title: 'Too warm, paused',
      line: '42.6 °C now. Resumes below 39 °C.',
    });
  });

  it('overtemp release text follows INFO ch.ot.clear (no hard-coded 39)', () => {
    const raw = JSON.parse(V0_INFO);
    raw.ch.ot = { trip: 40, clear: 37.5 };
    const safety = parseInfo(raw)!.safety;
    const b = bannerFor(deriveScreenState(st({ overTemp: true })), tlm({ ntc: 40.1, ot: 1 }), null, safety)!;
    expect(b.line).toBe('40.1 °C now. Resumes below 37.5 °C.');
  });

  describe('over-temp numbers come only from the device (no placeholders)', () => {
    const ot = deriveScreenState(st({ overTemp: true }));
    const noOt = (() => {
      const raw = JSON.parse(V0_INFO);
      delete raw.ch.ot;
      return parseInfo(raw)!.safety;
    })();
    it('INFO with ch.ot -> shows the device clear value', () => {
      const raw = JSON.parse(V0_INFO);
      raw.ch.ot = { trip: 41, clear: 36 };
      const b = bannerFor(ot, tlm({ ntc: 41.2, ot: 1 }), null, parseInfo(raw)!.safety)!;
      expect(b.line).toBe('41.2 °C now. Resumes below 36 °C.');
    });
    it('INFO without ch.ot -> generic line, the fallback 39 is never shown', () => {
      expect(noOt.fromInfo.ot).toBe(false);
      expect(noOt.ot.clearC).toBe(39); // fallback still exists for the client's legacy trip logic
      const b = bannerFor(ot, tlm({ ntc: 43, ot: 1 }), null, noOt)!;
      expect(b.line).toBe('43 °C now. Resumes when cooler.');
      expect(b.line).not.toMatch(/39/);
      // legacy INFO (no ch at all) and no INFO at all behave the same
      expect(bannerFor(ot, tlm({ ntc: 43, ot: 1 }), null, legacy.safety)!.line).toBe(
        '43 °C now. Resumes when cooler.',
      );
      expect(bannerFor(ot, tlm({ ntc: 43, ot: 1 }), null, null)!.line).toBe(
        '43 °C now. Resumes when cooler.',
      );
    });
    it('telemetry without ntcC -> no reading', () => {
      const noNtc = parseTelemetry({ t: 1, ppg: [], ot: 1 });
      expect(noNtc.ntcC).toBeNull();
      expect(bannerFor(ot, noNtc, null, safetyWithOt())!.line).toBe('Resumes below 39 °C.');
      expect(bannerFor(ot, tlm({ ntc: -99, ot: 1 }), null, safetyWithOt())!.line).toBe(
        'Resumes below 39 °C.',
      );
      // neither reading nor device threshold: exactly the generic line, no number at all
      const g = bannerFor(ot, noNtc, null, noOt)!.line;
      expect(g).toBe('Resumes when it cools down.');
      expect(g).not.toMatch(/\d/);
      expect(bannerFor(ot, null, null, null)!.line).toBe('Resumes when it cools down.');
    });
    it('low battery shows only the live TLM voltage, never a threshold or fallback', () => {
      const lb = deriveScreenState(st({ lowBattery: true }));
      expect(bannerFor(lb, tlm({ vbat: 3.38, lb: 1 }), null, noOt)!.line).toBe('3.38 V. Charge to continue.');
      const noV = bannerFor(lb, parseTelemetry({ t: 1, ppg: [], lb: 1 }), null, noOt)!;
      expect(noV.line).toBe('Charge the device to continue.');
      expect(JSON.stringify(noV)).not.toMatch(/3\.[47]|60 s/);
    });
  });

  it('lower-priority conditions add no lines: only the highest-priority notice shows', () => {
    const b = bannerFor(deriveScreenState(st({ lowBattery: true })), tlm({ vbat: 3.38, lb: 1 }), null)!;
    expect(b).toEqual({
      tone: 'warn',
      icon: 'battery',
      title: 'Battery low, paused',
      line: '3.38 V. Charge to continue.',
    });
    const all3 = deriveScreenState(st({ estop: true, overTemp: true, lowBattery: true }));
    expect(all3.also).toEqual(['overtemp', 'lowbat']);
    expect(bannerFor(all3, tlm({ ntc: 42.3, vbat: 3.38 }), 'app')).toEqual({
      tone: 'neutral',
      icon: 'lock',
      title: 'Everything is stopped',
      line: UNLOCK_LINE,
    });
    const ot2 = deriveScreenState(st({ overTemp: true, lowBattery: true }));
    expect(bannerFor(ot2, tlm({ ntc: 42.3, vbat: 3.38 }), null, safetyWithOt())).toMatchObject({
      title: 'Too warm, paused',
      line: '42.3 °C now. Resumes below 39 °C.',
    });
  });

  it('disconnected: Connection lost + Reconnect, or Not connected / Searching + Scan before any device', () => {
    const d = deriveScreenState(st({ status: 'disconnected' }));
    expect(bannerFor(d, null, null)).toEqual({
      tone: 'neutral',
      icon: 'bluetooth',
      title: 'Connection lost',
      line: 'Everything stopped.',
      action: 'reconnect',
    });
    // Stop all pressed while offline: ESTOP 1 goes out first on reconnect
    expect(bannerFor(d, null, null, null, { hadDevice: true, stopQueued: true })).toMatchObject({
      title: 'Connection lost',
      line: 'Stop all stays on.',
    });
    expect(bannerFor(d, null, null, null, { hadDevice: false })).toMatchObject({
      title: 'Not connected',
      line: 'Turn on ICD-001 nearby.',
      action: 'scan',
    });
    const c = deriveScreenState(st({ status: 'scanning' }));
    expect(bannerFor(c, null, null, null, { hadDevice: false })).toMatchObject({
      title: 'Searching…',
      line: 'Keep ICD-001 close.',
    });
  });

  it('every notice is exactly two single lines that fit one line at 390 pt; no em or en dashes', () => {
    expect(bannerFor(deriveScreenState(st({})), tlm(), null)).toBeNull();
    const D = deriveScreenState(st({ status: 'disconnected' }));
    const S = deriveScreenState(st({ status: 'scanning' }));
    const E = deriveScreenState(st({ estop: true, overTemp: true, lowBattery: true }));
    const O = deriveScreenState(st({ overTemp: true }));
    const L = deriveScreenState(st({ lowBattery: true }));
    // [notice, has action button]
    const all: Array<[BannerModel | null, boolean]> = [
      [COOLED_DOWN_BANNER, false],
      [RELEASED_ON_DEVICE_BANNER, false],
      [bannerFor(E, tlm(), 'app'), false],
      [bannerFor(E, tlm(), 'unknown'), false],
      [bannerFor(E, tlm(), 'device'), false],
      [
        bannerFor(O, tlm({ ntc: 42.3 }), null, {
          ot: { tripC: 40, clearC: 36.5 },
          fromInfo: { ot: true, lb: true },
        }),
        false,
      ],
      [bannerFor(O, tlm({ ntc: 42.3 }), null, null), false],
      [bannerFor(O, null, null, null), false],
      [bannerFor(L, tlm({ vbat: 3.38 }), null), false],
      [bannerFor(L, null, null), false],
      [bannerFor(D, null, null), true],
      [bannerFor(D, null, null, null, { hadDevice: true, stopQueued: true }), true],
      [bannerFor(D, null, null, null, { hadDevice: false }), true],
      [bannerFor(S, null, null, null, { hadDevice: false }), true],
    ];
    for (const [b, action] of all) {
      expect(b).not.toBeNull();
      expect(Object.keys(b!).sort()).toEqual(
        action ? ['action', 'icon', 'line', 'title', 'tone'] : ['icon', 'line', 'title', 'tone'],
      );
      expect(b!.title).toMatch(/^[^\n]+$/);
      expect(b!.line).toMatch(/^[^\n]+$/);
      // Proxy for the one-line fit (measured with Quicksand-Bold: ≈7.2 pt/char at
      // 14 pt, ≈7.0 at 13 pt): 266 pt without an action, ≈131 pt next to a busy one.
      expect(b!.title.length).toBeLessThanOrEqual(action ? 18 : 32);
      expect(b!.line.length).toBeLessThanOrEqual(action ? 24 : 38);
      expect(JSON.stringify(b)).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe('device strip values', () => {
  it('battery %: 3.40 V = 0 %, 4.20 V = 100 % (§8.1 provisional linear)', () => {
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
    expect(tempText(null)).toBe('n/a');
  });
});

describe('cards from INFO', () => {
  it('v0: wings (2 groups) + pulse (VHZ ch.vhz 2–50 ∩ app 1–30) + bullet (read-only)', () => {
    const cards = buildCards(v0);
    expect(cards.map(c => `${c.id}:${c.kind}`)).toEqual(['wing:intensity', 'vcm:rhythm', 'egg:sensor']);
    const w = cards[0];
    expect(w.kind === 'intensity' && w.groups.map(g => `${g.id}=${g.label}`)).toEqual(['A=上翼', 'B=下翼']);
    const p = cards[1] as RhythmCard;
    expect(p.range).toEqual({ min: 2, max: 30, def: 10 });
    expect(p.device).toEqual({ min: 2, max: 50 });
    expect(cards[2]).toMatchObject({ ppgIndex: 3, hasActuator: false });
  });

  it('rows carry design v2 app subtitles, never INFO labels', () => {
    expect(buildCards(v0).map(c => [c.label, c.subtitle])).toEqual([
      ['Wings', 'Upper and lower pairs'],
      ['Pulse', 'Voice coil rhythm'],
      ['Bullet', 'Sensor only'],
    ]);
  });

  it('wing groups carry app copy + hotspot zone (§8.5), independent of INFO labels', () => {
    const raw = JSON.parse(V0_INFO);
    raw.ch.lra = { A: 'Upper', B: 'Lower' };
    const w = buildCards(parseInfo(raw))[0];
    if (w.kind !== 'intensity') {
      throw new Error('expected intensity');
    }
    expect(w.groups.map(g => [g.id, g.index, g.zone, g.name, g.short, g.detail, g.label])).toEqual([
      ['A', 0, 'upper', 'Upper wings', 'Upper', 'left + right', 'Upper'],
      ['B', 1, 'lower', 'Lower wings', 'Lower', 'left + right', 'Lower'],
    ]);
    expect(HOTSPOT_ZONES).toEqual({
      upper: { card: 'wing', group: 'A' },
      lower: { card: 'wing', group: 'B' },
      head: { card: 'vcm' },
      bullet: { card: 'egg' },
    });
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

  it('range: app target 1–30 Hz (Maxwell 10/07), always clamped to INFO ch.vhz', () => {
    expect(VHZ_UI_MIN).toBe(1);
    expect(VHZ_UI_MAX).toBe(30);
    // fw 1.1.x reports 2–50 -> slider 2–30
    expect(rhythmRange({ minHz: 2, maxHz: 50, defaultHz: 10, command: 'VHZ' })).toEqual({ min: 2, max: 30, def: 10 });
    // fw widened to 1–30 -> slider exactly 1–30
    expect(rhythmRange({ minHz: 1, maxHz: 30, defaultHz: 10, command: 'VHZ' })).toEqual({ min: 1, max: 30, def: 10 });
    // fw 1–50 -> 1–30
    expect(rhythmRange({ minHz: 1, maxHz: 50, defaultHz: 40, command: 'VHZ' })).toEqual({ min: 1, max: 30, def: 30 });
    // device range entirely above 30 keeps its own range (never sends out-of-range)
    expect(rhythmRange({ minHz: 40, maxHz: 50, defaultHz: 45, command: 'VHZ' })).toEqual({ min: 40, max: 50, def: 45 });
    // placeholder (never connected) shows the 1–30 target
    expect((buildCards(PLACEHOLDER_INFO).find(c => c.id === 'vcm') as RhythmCard).range).toEqual({ min: 1, max: 30, def: 10 });
  });

  it('remembered Pulse Hz is clamped to 1–30', () => {
    expect(clampPulseTarget(42)).toBe(30);
    expect(clampPulseTarget(50)).toBe(30);
    expect(clampPulseTarget(0.6)).toBe(1);
    expect(clampPulseTarget(12)).toBe(12);
    expect(clampPulseTarget(0)).toBe(0);
    expect(clampPulseTarget(NaN)).toBe(0);
  });

  it('range: a narrow VHZ range inside 1–30 is kept; min/max from INFO', () => {
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
    groups: ['A', 'B'],
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

  it('wing frequency is fixed at 170 Hz: correction only when the device reports otherwise', () => {
    expect(WING_FREQ_HZ).toBe(170);
    expect(wingFreqCorrection(v0, 170)).toBeNull();
    expect(wingFreqCorrection(v0, undefined)).toBeNull(); // INFO def 170
    expect(wingFreqCorrection(v0, 200)).toEqual({ fn: 'setFreq', hz: 170 });
    const def150: DeviceInfo = {
      ...v0,
      modules: { ...v0.modules, wings: { ...v0.modules.wings!, freq: { min: 100, max: 300, def: 150 } } },
    };
    expect(wingFreqCorrection(def150, null)).toEqual({ fn: 'setFreq', hz: 170 });
    expect(wingFreqCorrection(def150, 170)).toBeNull(); // TLM wins over INFO def
    expect(wingFreqCorrection({ ...v0, modules: { ...v0.modules, wings: null } }, 200)).toBeNull();
    expect(wingFreqCorrection(null, 200)).toBeNull();
    expect(callToWire({ fn: 'setFreq', hz: WING_FREQ_HZ }, v0)).toBe('FREQ 170');
  });

  it('pulse slider/preset -> VHZ hz within device ∩ 1–30; switch off -> VHZ 0', () => {
    expect(wire({ t: 'pulseSlider', hz: 30 })).toEqual(['VHZ 30']);
    expect(wire({ t: 'pulseSlider', hz: 4 })).toEqual(['VHZ 4']);
    expect(wire({ t: 'pulseSlider', hz: 1 })).toEqual(['VHZ 2']); // fw 1.1.x min 2
    expect(wire({ t: 'pulseSlider', hz: 80 })).toEqual(['VHZ 30']);
    expect(wire({ t: 'pulsePreset', hz: 46 })).toEqual(['VHZ 30']);
    expect(wire({ t: 'pulseSwitch', on: false, lastHz: 30 })).toEqual(['VHZ 0']);
    expect(wire({ t: 'pulseSwitch', on: true, lastHz: 30 })).toEqual(['VHZ 30']);
    expect(wire({ t: 'pulseSwitch', on: true, lastHz: 45 })).toEqual(['VHZ 30']); // old remembered value
    expect(wire({ t: 'pulseSwitch', on: true, lastHz: 0 })).toEqual(['VHZ 10']);
    expect(pulse.range.min).toBe(2);
    expect(pulse.range.max).toBe(30);
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
      groups: ['A', 'B'],
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
    expect(vhz[vhz.length - 1]).toBe('VHZ 30');
    expect(vhz.length).toBeLessThanOrEqual(2);
    expect(dev.snapshot()).toMatchObject({ lra: [100, 0], vcmOn: true, vcmHz: 30 });

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
