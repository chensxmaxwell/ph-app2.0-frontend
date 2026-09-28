import { describe, expect, it } from '@jest/globals';

import {
  ICD001_MIN_WRITE_BYTES,
  acceptScanResult,
  encodeCommand,
  formatLpulse,
  safetyErrOf,
  LineAssembler,
  VCM_LEGACY_HZ,
  BATTERY_CURVE_LINEAR_V8,
  LB_FALLBACK,
  OT_FALLBACK,
  batteryPercent,
  getBatteryCurve,
  setBatteryCurve,
  clampVcmHz,
  classifyDeviceName,
  formatEstop,
  formatFreq,
  formatLra,
  formatRate,
  formatStop,
  formatVcmHz,
  halfMsToHz,
  parseInfo,
  parseLine,
  parseTelemetry,
  vcmHzToHalfMs,
} from '../../src/services/icd001/protocol';
import { encodeUtf8 } from '../../src/services/icd001/utf8';

const LEGACY_TLM =
  '{"t":12345,"ppg":[[51000,1,72],[0,0,0],[300,0,0]],"fsr":[1,2,3,4,5],"hall":-3,"ntc":-99.0,"vbat":3.95,' +
  '"acc":[0.01,-0.02,1.00],"gyr":[0,1,2],"lra":[40,0],"f":170,"vcm":[1,50],"auto":0,"estop":0}';

// §7.3 / §7.7: v0 frame has vhz (Hz, 0 = off), lp, ot, lb and no vcm.
const V0_TLM =
  '{"t":99,"ppg":[[1,1,70],[1,1,0],[1,0,0],[1,1,66]],"fsr":[0,0,0,0,0],"hall":0,"ntc":36.2,"vbat":3.38,' +
  '"acc":[0,0,1],"gyr":[0,0,0],"lra":[10,20],"lp":[[300,200],[0,0]],"f":180,"vhz":35,"auto":0,"estop":1,' +
  '"ot":1,"lb":1}';

const LEGACY_INFO = '{"fw":"h11-demo-ble","ver":"1.0","mux":1,"adsA":1,"adsB":0,"imu":1,"ppg":[1,0,1]}';
// §7.2 locked schema
const V0_INFO =
  '{"proto":"ICD001-0","prod":"ICD-001","hw":"H1.1","fw":"icd001-0.1","mux":1,"adsA":1,"adsB":1,"imu":1,' +
  '"ppg":[1,1,1,1],"ch":{"lra":{"A":"上翼","B":"下翼"},"freq":{"min":100,"max":300,"def":170},' +
  '"vhz":{"min":2,"max":50,"def":10},"lpulse":{"min":50,"max":2000},"ppg":["J13","J22","J23","EGG"],' +
  '"egg":{"ppg":3,"act":0},"ot":{"trip":42,"clear":39},"lb":{"trip":3.40,"clear":3.70,"holdS":60}}}';

describe('device name filter', () => {
  it('accepts ICD1- and H11- prefixes only', () => {
    expect(classifyDeviceName('ICD1-5A3C')).toBe('product');
    expect(classifyDeviceName('H11-91B1')).toBe('devboard');
    expect(classifyDeviceName('h11-91b1')).toBe('devboard');
    expect(classifyDeviceName('ICD2-0000')).toBeNull();
    expect(classifyDeviceName('Pleasure House')).toBeNull();
    expect(classifyDeviceName(undefined)).toBeNull();
  });

  it('scan: unnamed (adv packet, name pending in scan response) listed; foreign names dropped', () => {
    expect(acceptScanResult(null)).toBe(true);
    expect(acceptScanResult('')).toBe(true);
    expect(acceptScanResult('ICD1-5A3C')).toBe(true);
    expect(acceptScanResult('H11-91B1')).toBe(true);
    expect(acceptScanResult('Mi Band')).toBe(false);
  });
});

describe('LineAssembler', () => {
  it('reassembles a line split across packets', () => {
    const a = new LineAssembler();
    const bytes = encodeUtf8(`${LEGACY_TLM}\n`);
    const out: string[] = [];
    for (let i = 0; i < bytes.length; i += 20) {
      out.push(...a.push(bytes.slice(i, i + 20)));
    }
    expect(out).toEqual([LEGACY_TLM]);
    expect(a.pendingBytes).toBe(0);
  });

  it('handles several lines in one packet, CRLF and a trailing partial', () => {
    const a = new LineAssembler();
    expect(a.push(encodeUtf8('OK PONG\r\nEVT ESTOP 1\nOK LR'))).toEqual(['OK PONG', 'EVT ESTOP 1']);
    expect(a.push(encodeUtf8('A 10 0\n'))).toEqual(['OK LRA 10 0']);
  });

  it('does not corrupt a multi-byte UTF-8 char split across packets', () => {
    const a = new LineAssembler();
    const bytes = encodeUtf8('{"n":"上翼"}\n');
    const cut = bytes.indexOf(0xe4) + 1; // split inside 上
    expect(a.push(bytes.slice(0, cut))).toEqual([]);
    expect(a.push(bytes.slice(cut))).toEqual(['{"n":"上翼"}']);
  });

  it('drops runaway buffers without newline', () => {
    const a = new LineAssembler(16);
    a.push(new Array(40).fill(0x41));
    expect(a.pendingBytes).toBeLessThanOrEqual(16);
    expect(a.push(encodeUtf8('\nOK\n'))).toEqual(['OK']);
  });
});

describe('INFO safety thresholds (§8.4)', () => {
  it('v0 reads ch.ot / ch.lb', () => {
    const i = parseInfo(V0_INFO)!;
    expect(i.safety).toEqual({
      ot: { tripC: 42, clearC: 39 },
      lb: { tripV: 3.4, clearV: 3.7, holdS: 60 },
      fromInfo: { ot: true, lb: true },
    });
  });
  it('non-default INFO values are used as-is', () => {
    const raw = JSON.parse(V0_INFO);
    raw.ch.ot = { trip: 40, clear: 36.5 };
    raw.ch.lb = { trip: 3.3, clear: 3.8, holdS: 30 };
    expect(parseInfo(raw)!.safety).toMatchObject({
      ot: { tripC: 40, clearC: 36.5 },
      lb: { tripV: 3.3, clearV: 3.8, holdS: 30 },
    });
  });
  it('legacy / missing / invalid -> fallback 42/39 and 3.40/3.70/60 s', () => {
    expect(parseInfo(LEGACY_INFO)!.safety).toEqual({
      ot: OT_FALLBACK,
      lb: LB_FALLBACK,
      fromInfo: { ot: false, lb: false },
    });
    const raw = JSON.parse(V0_INFO);
    delete raw.ch.ot;
    raw.ch.lb = { trip: 3.8, clear: 3.4 }; // clear < trip: invalid
    const s = parseInfo(raw)!.safety;
    expect(s.fromInfo).toEqual({ ot: false, lb: false });
    expect(s.ot).toEqual({ tripC: 42, clearC: 39 });
    expect(s.lb).toEqual({ tripV: 3.4, clearV: 3.7, holdS: 60 });
    raw.ch.lb = { trip: 3.4, clear: 3.7 }; // holdS missing -> 60
    expect(parseInfo(raw)!.safety.lb.holdS).toBe(60);
  });
  it('legacy INFO group labels default to 上翼 / 下翼 (§8.5)', () => {
    expect(parseInfo(LEGACY_INFO)!.modules.wings!.groups.map(g => g.label)).toEqual(['上翼', '下翼']);
  });
});

describe('INFO parsing', () => {
  it('no proto => H11 v1.0 legacy: fixed A/B wings, VCM 2–20 Hz, no LPULSE', () => {
    const i = parseInfo(LEGACY_INFO)!;
    expect(i.proto).toBeNull();
    expect(i.legacy).toBe(true);
    expect(i.fw).toBe('h11-demo-ble');
    expect(i.modules.wings!.groups.map(g => g.id)).toEqual(['A', 'B']);
    expect(i.modules.wings!.lpulse).toBeNull();
    expect(i.modules.vcm).toEqual({ minHz: 2, maxHz: 20, defaultHz: 10, command: 'VCM' });
    expect(i.modules.ppg.map(p => p.present)).toEqual([true, false, true]);
    expect(i.modules.egg).toBeNull();
    expect(i.selfTest.adsB).toBe(0);
  });

  it('locked v0 schema: modules from ch (lra names, freq, vhz, lpulse, ppg names, egg)', () => {
    const i = parseInfo(V0_INFO)!;
    expect(i.proto).toBe('ICD001-0');
    expect(i.legacy).toBe(false);
    expect(i.prod).toBe('ICD-001');
    expect(i.modules.wings).toEqual({
      groups: [
        { id: 'A', index: 0, label: '上翼' },
        { id: 'B', index: 1, label: '下翼' },
      ],
      freq: { min: 100, max: 300, def: 170 },
      lpulse: { minMs: 50, maxMs: 2000 },
    });
    expect(i.modules.vcm).toEqual({ minHz: 2, maxHz: 50, defaultHz: 10, command: 'VHZ' });
    expect(i.modules.ppg.map(p => p.label)).toEqual(['J13', 'J22', 'J23', 'EGG']);
    expect(i.modules.ppg.every(p => p.present)).toBe(true);
    expect(i.modules.egg).toEqual({ ppgIndex: 3, hasActuator: false });
    expect(i.selfTest).not.toHaveProperty('proto');
  });

  it('H1.1 board on v0: ppg array length = real channel count (3), no egg', () => {
    const raw = JSON.parse(V0_INFO);
    raw.ppg = [1, 1, 1];
    raw.ch.ppg = ['J13', 'J22', 'J23'];
    delete raw.ch.egg;
    const i = parseInfo(raw)!;
    expect(i.modules.ppg).toHaveLength(3);
    expect(i.modules.egg).toBeNull();
  });

  it('ch fields drive modules: missing group, missing vhz, narrower ranges', () => {
    const raw = JSON.parse(V0_INFO);
    raw.ch.lra = { A: '上翼' };
    delete raw.ch.vhz;
    raw.ch.lpulse = { min: 100, max: 1000 };
    const i = parseInfo(raw)!;
    expect(i.modules.wings!.groups.map(g => g.id)).toEqual(['A']);
    expect(i.modules.wings!.lpulse).toEqual({ minMs: 100, maxMs: 1000 });
    expect(i.modules.vcm).toBeNull();
    raw.ch.vhz = { min: 10, max: 50 };
    expect(parseInfo(raw)!.modules.vcm).toEqual({ minHz: 10, maxHz: 50, defaultHz: 10, command: 'VHZ' });
  });

  it('old-style vcm key in ch is ignored (renamed vhz); ch without proto is legacy', () => {
    expect(parseInfo({ fw: 'x', ch: { vhz: { min: 2, max: 50 } } })!.legacy).toBe(true);
    expect(parseInfo({ fw: 'x', ch: { vhz: { min: 2, max: 50 } } })!.modules.vcm!.command).toBe('VCM');
    expect(
      parseInfo({ proto: 'ICD001-0', fw: 'x', ch: { vcm: { min: 2, max: 50 } } })!.modules.vcm,
    ).toBeNull();
  });

  it('rejects garbage', () => {
    expect(parseInfo('not json')).toBeNull();
    expect(parseInfo('[1,2]')).toBeNull();
    expect(parseInfo('{"t":1}')).toBeNull();
  });
});

describe('TLM parsing (format by field presence)', () => {
  it('legacy frame (only vcm): [on,halfMs] -> Hz, ntc -99 -> null, hr 0 -> null, no lb', () => {
    const t = parseTelemetry(JSON.parse(LEGACY_TLM));
    expect(t.format).toBe('legacy');
    expect(t.vcm).toEqual({ on: true, hz: 10 });
    expect(t.ntcC).toBeNull();
    expect(t.ppg[0]).toEqual({ ir: 51000, contact: true, hr: 72 });
    expect(t.ppg[1].hr).toBeNull();
    expect(t.lra).toEqual([40, 0]);
    expect(t.lp).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(t.lraFreqHz).toBe(170);
    expect(t.vbat).toBe(3.95);
    expect(t.batteryPct).toBe(69); // §8.1: 3.40 V = 0 %, 4.20 V = 100 %
    expect(t.ot).toBe(false);
    expect(t.lb).toBeNull();
    expect(t.estop).toBe(false);
  });

  it('v0 frame (vhz): Hz, lp, ot, lb, estop, 4 PPG', () => {
    const t = parseTelemetry(JSON.parse(V0_TLM));
    expect(t.format).toBe('v0');
    expect(t.vcm).toEqual({ on: true, hz: 35 });
    expect(t.lp).toEqual([
      [300, 200],
      [0, 0],
    ]);
    expect(t.ot).toBe(true);
    expect(t.lb).toBe(true);
    expect(t.estop).toBe(true);
    expect(t.ppg).toHaveLength(4);
    expect(t.ntcC).toBe(36.2);
  });

  it('vhz 0 = off; vhz wins over a stray vcm', () => {
    expect(parseTelemetry({ vhz: 0 }).vcm).toEqual({ on: false, hz: 0 });
    expect(parseTelemetry({ vhz: 40, vcm: [1, 50] }).vcm).toEqual({ on: true, hz: 40 });
    expect(parseTelemetry({ vcm: [1, 50] }).vcm.hz).toBe(10);
    expect(parseTelemetry({ vcm: [0, 25] }).vcm).toEqual({ on: false, hz: 20 });
  });

  it('tolerates missing / malformed fields; vbat < 1.0 V = not measured', () => {
    const t = parseTelemetry({ t: 1, ppg: 'x', lra: [5], vbat: 0.02, lp: 'x' });
    expect(t.lra).toEqual([5, 0]);
    expect(t.ppg).toEqual([]);
    expect(t.vbat).toBeNull();
    expect(t.batteryPct).toBeNull();
    expect(t.vcm).toEqual({ on: false, hz: null });
    expect(t.lp).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('battery §8.1: linear 3.40 V = 0 %, 4.20 V = 100 %, clamped', () => {
    expect(batteryPercent(4.3)).toBe(100);
    expect(batteryPercent(4.2)).toBe(100);
    expect(batteryPercent(3.4)).toBe(0);
    expect(batteryPercent(3.2)).toBe(0);
    expect(batteryPercent(3.8)).toBe(50);
    expect(batteryPercent(3.95)).toBe(69);
    expect(batteryPercent(0.5)).toBeNull();
    expect(batteryPercent(null)).toBeNull();
  });

  it('battery curve is swappable for a piecewise table', () => {
    const table = [
      [4.2, 100],
      [3.4, 0],
      [3.7, 20],
      [4.0, 80],
    ] as const;
    expect(
      batteryPercent(
        3.55,
        table.slice().sort((a, b) => a[0] - b[0]),
      ),
    ).toBe(10);
    setBatteryCurve(table);
    try {
      expect(getBatteryCurve().map(p => p[0])).toEqual([3.4, 3.7, 4.0, 4.2]);
      expect(batteryPercent(3.7)).toBe(20);
      expect(batteryPercent(3.85)).toBe(50);
      expect(batteryPercent(4.1)).toBe(90);
      expect(parseTelemetry({ vbat: 3.85 }).batteryPct).toBe(50);
    } finally {
      setBatteryCurve(BATTERY_CURVE_LINEAR_V8);
    }
    expect(batteryPercent(3.85)).toBe(56);
    expect(() => setBatteryCurve([[3.4, 0]])).toThrow();
  });
});

describe('parseLine', () => {
  it('classifies all line types', () => {
    expect(parseLine(LEGACY_TLM).kind).toBe('tlm');
    expect(parseLine(V0_TLM).kind).toBe('tlm');
    expect(parseLine(LEGACY_INFO).kind).toBe('info');
    expect(parseLine(V0_INFO).kind).toBe('info');
    expect(parseLine('OK LRA 40 0')).toEqual({ kind: 'ok', text: 'OK LRA 40 0', args: ['LRA', '40', '0'] });
    expect(parseLine('ERR ESTOP')).toMatchObject({ kind: 'err', args: ['ESTOP'] });
    expect(parseLine('EVT OVERTEMP 1')).toMatchObject({ kind: 'evt', name: 'OVERTEMP', args: ['1'] });
    expect(parseLine('EVT LOWBAT 0')).toMatchObject({ kind: 'evt', name: 'LOWBAT', args: ['0'] });
    expect(parseLine('EVT BLE_DISCONNECT STOP')).toMatchObject({ kind: 'evt', name: 'BLE_DISCONNECT' });
    expect(parseLine('{broken').kind).toBe('unknown');
    expect(parseLine('hello').kind).toBe('unknown');
  });

  it('maps firmware safety rejections', () => {
    expect(safetyErrOf(parseLine('ERR ESTOP'))).toBe('ESTOP');
    expect(safetyErrOf(parseLine('ERR OVERTEMP'))).toBe('OVERTEMP');
    expect(safetyErrOf(parseLine('ERR LOWBAT'))).toBe('LOWBAT');
    expect(safetyErrOf(parseLine('ERR OVERFLOW'))).toBeNull();
    expect(safetyErrOf(parseLine('ERR FREQ 100-300'))).toBeNull();
    expect(safetyErrOf(parseLine('OK ESTOP 1'))).toBeNull();
  });
});

describe('command formatting', () => {
  it('LRA uses 0/1/BOTH targets (never the ambiguous letter B) and clamps 0–100', () => {
    expect(formatLra('A', 55)).toBe('LRA 0 55');
    expect(formatLra('B', 55.6)).toBe('LRA 1 56');
    expect(formatLra('ALL', 120)).toBe('LRA BOTH 100');
    expect(formatLra('A', -5)).toBe('LRA 0 0');
    expect(formatLra('A', NaN)).toBe('LRA 0 0');
  });

  it('FREQ clamps to 100–300 or device range', () => {
    expect(formatFreq(170)).toBe('FREQ 170');
    expect(formatFreq(20)).toBe('FREQ 100');
    expect(formatFreq(999)).toBe('FREQ 300');
    expect(formatFreq(250, { min: 150, max: 200 })).toBe('FREQ 200');
  });

  it('STOP / ESTOP / RATE', () => {
    expect(formatStop()).toBe('STOP');
    expect(formatEstop(true)).toBe('ESTOP 1');
    expect(formatEstop(false)).toBe('ESTOP 0');
    expect(formatRate(50)).toBe('RATE 20');
    expect(formatRate(10)).toBe('RATE 10');
  });

  it('LPULSE t v on off, 0/1/BOTH targets, clamps to INFO lpulse range', () => {
    expect(formatLpulse('A', 60, 300, 200)).toBe('LPULSE 0 60 300 200');
    expect(formatLpulse('B', 101, 10, 5000)).toBe('LPULSE 1 100 50 2000');
    expect(formatLpulse('ALL', 50, 500, 500)).toBe('LPULSE BOTH 50 500 500');
    expect(formatLpulse('A', 50, 60, 1500, { minMs: 100, maxMs: 1000 })).toBe('LPULSE 0 50 100 1000');
  });

  it('every command goes out terminated by exactly one \\n', () => {
    expect(encodeCommand('STOP')).toEqual(encodeUtf8('STOP\n'));
    expect(encodeCommand('LRA 0 5\n')).toEqual(encodeUtf8('LRA 0 5\n'));
    expect(encodeCommand('VHZ 10;')).toEqual(encodeUtf8('VHZ 10\n'));
  });

  it('legacy-capable commands fit in a single 20-byte write including \\n', () => {
    const cmds = [
      formatLra('ALL', 100),
      formatFreq(300),
      formatVcmHz(50, { minHz: 2, maxHz: 50, defaultHz: 10, command: 'VHZ' }),
      formatVcmHz(2, { minHz: 2, maxHz: 20, defaultHz: 10, command: 'VCM' }),
      formatEstop(true),
      formatRate(20),
    ];
    cmds.forEach(c => expect(encodeCommand(c).length).toBeLessThanOrEqual(ICD001_MIN_WRITE_BYTES));
  });
});

describe('voice coil Hz mapping / clamp', () => {
  const v0 = { minHz: 2, maxHz: 50, defaultHz: 10, command: 'VHZ' as const };
  const legacy = {
    minHz: VCM_LEGACY_HZ.min,
    maxHz: VCM_LEGACY_HZ.max,
    defaultHz: 10,
    command: 'VCM' as const,
  };

  it('v0 sends VHZ hz clamped to the INFO range; 0 = off', () => {
    expect(formatVcmHz(10, v0)).toBe('VHZ 10');
    expect(formatVcmHz(50, v0)).toBe('VHZ 50');
    expect(formatVcmHz(80, v0)).toBe('VHZ 50');
    expect(formatVcmHz(1, v0)).toBe('VHZ 2');
    expect(formatVcmHz(0, v0)).toBe('VHZ 0');
    expect(formatVcmHz(-3, v0)).toBe('VHZ 0');
    expect(formatVcmHz(NaN, v0)).toBe('VHZ 0');
    expect(formatVcmHz(12.6, v0)).toBe('VHZ 13');
  });

  it('respects a narrower device-reported range (e.g. 10–50)', () => {
    const r = { ...v0, minHz: 10, maxHz: 50 };
    expect(formatVcmHz(4, r)).toBe('VHZ 10');
    expect(clampVcmHz(60, r)).toBe(50);
  });

  it('legacy maps Hz -> half-period ms = 500/Hz within 25–250 ms', () => {
    expect(formatVcmHz(10, legacy)).toBe('VCM 1 50');
    expect(formatVcmHz(20, legacy)).toBe('VCM 1 25');
    expect(formatVcmHz(2, legacy)).toBe('VCM 1 250');
    expect(formatVcmHz(50, legacy)).toBe('VCM 1 25'); // clamped to 20 Hz
    expect(formatVcmHz(1, legacy)).toBe('VCM 1 250'); // clamped to 2 Hz
    expect(formatVcmHz(0, legacy)).toBe('VCM 0');
    expect(formatVcmHz(3, legacy)).toBe('VCM 1 167');
  });

  it('half-period helpers never leave firmware limits', () => {
    for (let hz = 0.5; hz <= 100; hz += 0.5) {
      const ms = vcmHzToHalfMs(hz);
      expect(ms).toBeGreaterThanOrEqual(25);
      expect(ms).toBeLessThanOrEqual(250);
    }
    expect(halfMsToHz(50)).toBe(10);
    expect(halfMsToHz(167)).toBe(3);
  });
});
