import { describe, expect, it } from '@jest/globals';

import {
  ICD001_MIN_WRITE_BYTES,
  LineAssembler,
  VCM_LEGACY_HZ,
  batteryPercent,
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

const V0_TLM =
  '{"t":99,"ppg":[[1,1,70],[1,1,0],[1,0,0],[1,1,66]],"fsr":[0,0,0,0,0],"hall":0,"ntc":36.2,"vbat":3.38,' +
  '"acc":[0,0,1],"gyr":[0,0,0],"lra":[10,20],"f":180,"vcm":[1,35],"auto":0,"estop":1,"ot":1}';

const LEGACY_INFO = '{"fw":"h11-demo-ble","ver":"1.0","mux":1,"adsA":1,"adsB":0,"imu":1,"ppg":[1,0,1]}';
const V0_INFO = JSON.stringify({
  prod: 'ICD-001',
  hw: 'H1.1',
  fw: 'icd001-0.1',
  ppg: [1, 1, 1, 1],
  ch: {
    lra: { A: '上翼', B: '下翼' },
    vcm: { min: 2, max: 50 },
    ppg: ['L', 'R', 'M', '跳蛋'],
  },
});

describe('device name filter', () => {
  it('accepts ICD1- and H11- prefixes only', () => {
    expect(classifyDeviceName('ICD1-5A3C')).toBe('product');
    expect(classifyDeviceName('H11-91B1')).toBe('devboard');
    expect(classifyDeviceName('h11-91b1')).toBe('devboard');
    expect(classifyDeviceName('ICD2-0000')).toBeNull();
    expect(classifyDeviceName('Pleasure House')).toBeNull();
    expect(classifyDeviceName(undefined)).toBeNull();
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

describe('INFO parsing', () => {
  it('legacy h11-demo-ble INFO -> fallback modules, legacy VCM 2–20 Hz', () => {
    const i = parseInfo(LEGACY_INFO)!;
    expect(i.fw).toBe('h11-demo-ble');
    expect(i.prod).toBeNull();
    expect(i.hasChannelTable).toBe(false);
    expect(i.vcmUnits).toBe('halfMs');
    expect(i.modules.wings!.groups.map(g => g.id)).toEqual(['A', 'B']);
    expect(i.modules.vcm).toEqual({
      minHz: 2,
      maxHz: 20,
      defaultHz: 10,
      command: 'VCM',
    });
    expect(i.modules.ppg.map(p => p.present)).toEqual([true, false, true]);
    expect(i.modules.egg).toBeNull();
    expect(i.selfTest.adsB).toBe(0);
  });

  it('v0 INFO -> modules from ch, VHZ with reported range, egg sensor only', () => {
    const i = parseInfo(V0_INFO)!;
    expect(i.prod).toBe('ICD-001');
    expect(i.hasChannelTable).toBe(true);
    expect(i.vcmUnits).toBe('hz');
    expect(i.modules.wings!.groups).toEqual([
      { id: 'A', index: 0, label: '上翼' },
      { id: 'B', index: 1, label: '下翼' },
    ]);
    expect(i.modules.vcm).toEqual({
      minHz: 2,
      maxHz: 50,
      defaultHz: 10,
      command: 'VHZ',
    });
    expect(i.modules.ppg).toHaveLength(4);
    expect(i.modules.egg).toEqual({ ppgIndex: 3, hasActuator: false });
  });

  it('ch without vcm range falls back to legacy VCM; ch.vcm=0 hides the module', () => {
    expect(parseInfo({ fw: 'x', ch: { lra: 2 } })!.modules.vcm!.command).toBe('VCM');
    expect(parseInfo({ fw: 'x', ch: { vcm: 0 } })!.modules.vcm).toBeNull();
    expect(parseInfo({ fw: 'x', ch: { lra: ['only A'] } })!.modules.wings!.groups).toHaveLength(1);
    expect(parseInfo({ fw: 'x', ch: { lra: 0 } })!.modules.wings).toBeNull();
  });

  it('rejects garbage', () => {
    expect(parseInfo('not json')).toBeNull();
    expect(parseInfo('[1,2]')).toBeNull();
    expect(parseInfo('{"t":1}')).toBeNull();
  });
});

describe('TLM parsing', () => {
  it('legacy frame: vcm [on,halfMs] -> Hz, ntc -99 -> null, hr 0 -> null', () => {
    const t = parseTelemetry(JSON.parse(LEGACY_TLM), 'halfMs');
    expect(t.vcm).toEqual({ on: true, hz: 10 });
    expect(t.ntcC).toBeNull();
    expect(t.ppg[0]).toEqual({ ir: 51000, contact: true, hr: 72 });
    expect(t.ppg[1].hr).toBeNull();
    expect(t.lra).toEqual([40, 0]);
    expect(t.lraFreqHz).toBe(170);
    expect(t.vbat).toBe(3.95);
    expect(t.batteryPct).toBe(64);
    expect(t.ot).toBe(false);
    expect(t.estop).toBe(false);
  });

  it('v0 frame: vcm [on,hz], ot, estop, 4 PPG', () => {
    const t = parseTelemetry(JSON.parse(V0_TLM), 'hz');
    expect(t.vcm).toEqual({ on: true, hz: 35 });
    expect(t.ot).toBe(true);
    expect(t.estop).toBe(true);
    expect(t.ppg).toHaveLength(4);
    expect(t.ntcC).toBe(36.2);
  });

  it('same array read with the wrong units would differ, units come from INFO', () => {
    expect(parseTelemetry({ vcm: [1, 50] }, 'hz').vcm.hz).toBe(50);
    expect(parseTelemetry({ vcm: [1, 50] }, 'halfMs').vcm.hz).toBe(10);
    expect(parseTelemetry({ vcm: [1, 0] }, 'hz').vcm.on).toBe(false);
  });

  it('tolerates missing / malformed fields', () => {
    const t = parseTelemetry({ t: 1, ppg: 'x', lra: [5], vbat: 0.02 }, 'hz');
    expect(t.lra).toEqual([5, 0]);
    expect(t.ppg).toEqual([]);
    expect(t.vbat).toBeNull();
    expect(t.batteryPct).toBeNull();
    expect(t.vcm).toEqual({ on: false, hz: null });
  });

  it('battery linear 3.5–4.2 V clamped', () => {
    expect(batteryPercent(4.3)).toBe(100);
    expect(batteryPercent(3.5)).toBe(0);
    expect(batteryPercent(3.2)).toBe(0);
    expect(batteryPercent(3.85)).toBe(50);
    expect(batteryPercent(null)).toBeNull();
  });
});

describe('parseLine', () => {
  it('classifies all line types', () => {
    expect(parseLine(LEGACY_TLM, 'halfMs').kind).toBe('tlm');
    expect(parseLine(LEGACY_INFO, 'halfMs').kind).toBe('info');
    expect(parseLine('OK LRA 40 0', 'hz')).toEqual({
      kind: 'ok',
      text: 'OK LRA 40 0',
      args: ['LRA', '40', '0'],
    });
    expect(parseLine('ERR ESTOP', 'hz')).toMatchObject({
      kind: 'err',
      args: ['ESTOP'],
    });
    expect(parseLine('EVT OVERTEMP 1', 'hz')).toMatchObject({
      kind: 'evt',
      name: 'OVERTEMP',
      args: ['1'],
    });
    expect(parseLine('EVT BLE_DISCONNECT STOP', 'hz')).toMatchObject({
      kind: 'evt',
      name: 'BLE_DISCONNECT',
    });
    expect(parseLine('{broken', 'hz').kind).toBe('unknown');
    expect(parseLine('hello', 'hz').kind).toBe('unknown');
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

  it('every command fits in a single 20-byte write', () => {
    const cmds = [
      formatLra('ALL', 100),
      formatFreq(300),
      formatVcmHz(50, { minHz: 2, maxHz: 50, defaultHz: 10, command: 'VHZ' }),
      formatVcmHz(2, { minHz: 2, maxHz: 20, defaultHz: 10, command: 'VCM' }),
      formatEstop(true),
      formatRate(20),
    ];
    cmds.forEach(c => expect(encodeUtf8(c).length).toBeLessThanOrEqual(ICD001_MIN_WRITE_BYTES));
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
