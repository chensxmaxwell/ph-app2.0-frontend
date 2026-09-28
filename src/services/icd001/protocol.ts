/**
 * ICD-001 / H1.1 BLE protocol: constants, line reassembly, INFO/TLM parsing,
 * command formatting. Pure TypeScript, no React Native imports, so it is unit
 * testable in Jest.
 *
 * Source of truth: /workspace/firmware/PROTOCOL-ICD001.md (v0 draft) on top of
 * /workspace/firmware/h11-demo-ble/PROTOCOL.md (H1.1 v1.0, what the dev board
 * H11-91B1 runs today).
 */
import { decodeUtf8, encodeUtf8 } from './utf8';

// ---------------------------------------------------------------- constants

export const ICD001_SERVICE_UUID = '6e400001-4831-4d31-9a00-000000000001';
export const ICD001_CMD_UUID = '6e400002-4831-4d31-9a00-000000000001';
export const ICD001_TLM_UUID = '6e400003-4831-4d31-9a00-000000000001';
export const ICD001_INFO_UUID = '6e400004-4831-4d31-9a00-000000000001';

/** Product (ICD1-XXXX, v0) and H1.1 dev board (H11-XXXX). */
export const ICD001_NAME_PREFIXES = {
  product: 'ICD1-',
  devboard: 'H11-',
} as const;

export const ICD001_REQUESTED_MTU = 247;
/**
 * ATT payload with the default MTU of 23. H11 v1.0 firmware executes whatever
 * one write contains, so legacy commands must fit in one write; v0 buffers
 * until `\n` (§7.4) so longer commands (LPULSE) may span writes.
 */
export const ICD001_MIN_WRITE_BYTES = 20;

/** Telemetry rate the app asks for (firmware allows 0–20 Hz, default 5). */
export const ICD001_DEFAULT_TLM_HZ = 10;

export const LRA_MIN = 0;
export const LRA_MAX = 100;
export const LRA_FREQ_FALLBACK = { min: 100, max: 300, def: 170 } as const;

/** Legacy `VCM on halfMs` limits (h11-demo-ble): half-period 25–250 ms = 2–20 Hz. */
export const VCM_LEGACY_HALF_MS = { min: 25, max: 250 } as const;
export const VCM_LEGACY_HZ = { min: 2, max: 20 } as const;
/** Default beat frequency when the device does not say (protocol: VHZ default 10). */
export const VCM_DEFAULT_HZ = 10;

/**
 * Battery % curve (PROTOCOL §8.1, provisional): linear 3.40 V = 0 %, 4.20 V = 100 %.
 * The 0 % point equals the firmware low-battery cut. A measured piecewise
 * table will replace this: call setBatteryCurve() / edit the default (sorted [volts, percent] points,
 * interpolated linearly between points, clamped outside).
 */
export type BatteryCurve = ReadonlyArray<readonly [volts: number, pct: number]>;
export const BATTERY_CURVE_LINEAR_V8: BatteryCurve = [
  [3.4, 0],
  [4.2, 100],
];
let batteryCurve: BatteryCurve = BATTERY_CURVE_LINEAR_V8;
export function getBatteryCurve(): BatteryCurve {
  return batteryCurve;
}
/** Install a measured discharge table (sorted by volts here). */
export function setBatteryCurve(curve: BatteryCurve): void {
  if (curve.length < 2) {
    throw new Error('battery curve needs ≥ 2 points');
  }
  batteryCurve = [...curve].sort((a, b) => a[0] - b[0]);
}

/**
 * Safety thresholds come from INFO `ch.ot` / `ch.lb` (§8.4). These values are
 * ONLY a fallback for firmware whose INFO lacks them (H11 v1.0 legacy).
 */
export const OT_FALLBACK = { tripC: 42, clearC: 39 } as const;
export const LB_FALLBACK = { tripV: 3.4, clearV: 3.7, holdS: 60 } as const;
/** Below this we assume vbat is not wired / not measured (e.g. dev board on USB). */
export const VBAT_VALID_MIN = 1.0;

export type DeviceKind = 'product' | 'devboard';

export function classifyDeviceName(name?: string | null): DeviceKind | null {
  if (!name) {
    return null;
  }
  const n = name.trim().toUpperCase();
  if (n.startsWith(ICD001_NAME_PREFIXES.product)) {
    return 'product';
  }
  if (n.startsWith(ICD001_NAME_PREFIXES.devboard)) {
    return 'devboard';
  }
  return null;
}

/**
 * Scan results come from an OS-level service-UUID filter with active scanning
 * (§7.7: the advertising packet has only the UUID, the name is in the scan
 * response). A result without a name yet is listed (name arrives with the scan
 * response); a named result must carry the ICD1- / H11- prefix.
 */
export function acceptScanResult(name?: string | null): boolean {
  return !name || classifyDeviceName(name) !== null;
}

// ---------------------------------------------------------------- reassembly

/**
 * TLM notifications are chunks of `\n`-terminated lines (firmware splits a
 * line into MTU-3 byte packets). Reassemble at the byte level so a multi-byte
 * UTF-8 character split across packets is not corrupted.
 */
export class LineAssembler {
  private buf: number[] = [];
  private discarding = false;

  constructor(private readonly maxLineBytes = 4096) {}

  push(chunk: ArrayLike<number>): string[] {
    const lines: string[] = [];
    for (let i = 0; i < chunk.length; i++) {
      // eslint-disable-next-line no-bitwise
      const b = chunk[i] & 0xff;
      if (b === 0x0a) {
        if (this.discarding) {
          this.discarding = false;
          this.buf = [];
          continue;
        }
        const line = decodeUtf8(this.buf).replace(/\r$/, '').trim();
        this.buf = [];
        if (line.length) {
          lines.push(line);
        }
      } else if (!this.discarding) {
        this.buf.push(b);
        if (this.buf.length > this.maxLineBytes) {
          // Garbage / missing newline: drop the rest of this line.
          this.buf = [];
          this.discarding = true;
        }
      }
    }
    return lines;
  }

  reset(): void {
    this.buf = [];
    this.discarding = false;
  }

  get pendingBytes(): number {
    return this.buf.length;
  }
}

// ---------------------------------------------------------------- helpers

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function flag(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null;
}

function numArr(v: unknown): number[] {
  return Array.isArray(v) ? v.map(x => num(x) ?? 0) : [];
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ---------------------------------------------------------------- INFO

/** Protocol id in v0 INFO (§7.2). INFO without `proto` = H11 v1.0 legacy. */
export const ICD001_PROTO_V0 = 'ICD001-0';

export type LraGroupId = 'A' | 'B';

export interface LraGroup {
  id: LraGroupId;
  /** Firmware target index: A = 0 (J10), B = 1 (J11). */
  index: 0 | 1;
  label: string;
}

export interface VcmCaps {
  minHz: number;
  maxHz: number;
  defaultHz: number;
  /** 'VHZ' = v0 `VHZ hz`; 'VCM' = legacy `VCM on halfMs` (H11 v1.0). */
  command: 'VHZ' | 'VCM';
}

/** Wing rhythm (`LPULSE`), v0 only. */
export interface LpulseCaps {
  minMs: number;
  maxMs: number;
}

export interface PpgChannel {
  index: number;
  label: string;
  present: boolean | null;
}

export interface EggCaps {
  ppgIndex: number;
  /** `egg.act` 0 = no actuator in the egg; UI greys out control. */
  hasActuator: boolean;
}

export interface SafetyThresholds {
  /** Over-temp: trip at ntc ≥ tripC, clear below clearC. */
  ot: { tripC: number; clearC: number };
  /** Low battery: trip below tripV; clear above clearV held for holdS seconds. */
  lb: { tripV: number; clearV: number; holdS: number };
  /** true when both came from INFO `ch.ot` / `ch.lb`; false = fallback values. */
  fromInfo: { ot: boolean; lb: boolean };
}

export interface DeviceModules {
  wings: {
    groups: LraGroup[];
    freq: { min: number; max: number; def: number };
    /** null on legacy firmware (no LPULSE). */
    lpulse: LpulseCaps | null;
  } | null;
  vcm: VcmCaps | null;
  ppg: PpgChannel[];
  egg: EggCaps | null;
}

export interface DeviceInfo {
  /** e.g. "ICD001-0"; null = H11 v1.0 legacy firmware. */
  proto: string | null;
  legacy: boolean;
  prod: string | null;
  hw: string | null;
  fw: string | null;
  ver: string | null;
  modules: DeviceModules;
  /** Safety thresholds from INFO `ch.ot` / `ch.lb` (§8.4), fallback when absent. */
  safety: SafetyThresholds;
  selfTest: Record<string, unknown>;
  raw: Json;
}

/** §8.5: A (J10) = left + right upper wings, B (J11) = left + right lower wings. */
const DEFAULT_LRA_LABELS: Record<LraGroupId, string> = { A: '上翼', B: '下翼' };
export const LPULSE_FALLBACK: LpulseCaps = { minMs: 50, maxMs: 2000 };

/** ch.lra is locked as {"A":"上翼","B":"下翼"}; a group missing from the object is absent. */
function parseLraGroups(v: unknown): LraGroup[] {
  const ids: LraGroupId[] = ['A', 'B'];
  if (!isObj(v)) {
    return [];
  }
  const out: LraGroup[] = [];
  ids.forEach((id, i) => {
    const e = v[id];
    if (e === undefined || e === null || e === 0 || e === false) {
      return;
    }
    out.push({ id, index: i as 0 | 1, label: str(e) || DEFAULT_LRA_LABELS[id] });
  });
  return out;
}

function parseRange(v: unknown): { min: number; max: number; def: number | null } | null {
  if (!isObj(v)) {
    return null;
  }
  const min = num(v.min);
  const max = num(v.max);
  if (min === null || max === null || min <= 0 || max < min) {
    return null;
  }
  return { min, max, def: num(v.def) };
}

function parsePpg(names: unknown, selfTestPpg: unknown): PpgChannel[] {
  const present = Array.isArray(selfTestPpg) ? selfTestPpg.map(flag) : [];
  const mk = (index: number, label: string | null): PpgChannel => ({
    index,
    label: label || `PPG${index}`,
    present: index < present.length ? present[index] : null,
  });
  // v0: ch.ppg is an array of names; its length is the real channel count.
  if (Array.isArray(names)) {
    return names.map((e, i) => mk(i, str(e)));
  }
  return present.map((_, i) => mk(i, null));
}

function parseSafety(ch: Json | null): SafetyThresholds {
  const ot = ch && isObj(ch.ot) ? ch.ot : null;
  const lb = ch && isObj(ch.lb) ? ch.lb : null;
  const trip = ot ? num(ot.trip) : null;
  const clear = ot ? num(ot.clear) : null;
  const otOk = trip !== null && clear !== null && clear <= trip;
  const lbTrip = lb ? num(lb.trip) : null;
  const lbClear = lb ? num(lb.clear) : null;
  const lbHold = lb ? num(lb.holdS) : null;
  const lbOk = lbTrip !== null && lbClear !== null && lbClear >= lbTrip;
  return {
    ot: otOk ? { tripC: trip, clearC: clear } : { ...OT_FALLBACK },
    lb: lbOk
      ? { tripV: lbTrip, clearV: lbClear, holdS: lbHold !== null && lbHold >= 0 ? lbHold : LB_FALLBACK.holdS }
      : { ...LB_FALLBACK },
    fromInfo: { ot: otOk, lb: lbOk },
  };
}

const LEGACY_VCM: VcmCaps = {
  minHz: VCM_LEGACY_HZ.min,
  maxHz: VCM_LEGACY_HZ.max,
  defaultHz: VCM_DEFAULT_HZ,
  command: 'VCM',
};

/**
 * Parse the INFO characteristic / `INFO` reply (schema locked in §7.2):
 * {"proto":"ICD001-0","prod":"ICD-001","hw":"H1.1","fw":"…",<self-test>,
 *  "ch":{"lra":{"A":"上翼","B":"下翼"},"freq":{min,max,def},"vhz":{min,max,def},
 *        "lpulse":{min,max},"ppg":["J13","J22","J23","EGG"],"egg":{"ppg":3,"act":0},
 *        "ot":{"trip":42,"clear":39},"lb":{"trip":3.40,"clear":3.70,"holdS":60}}}   (ot/lb: §8.4)
 * No `proto` => H11 v1.0 legacy (h11-demo-ble): fixed J10/J11 LRA, VCM 2–20 Hz,
 * no LPULSE, PPG count from the self-test array.
 */
export function parseInfo(input: string | Json): DeviceInfo | null {
  let raw: Json;
  if (typeof input === 'string') {
    try {
      const parsed: unknown = JSON.parse(input);
      if (!isObj(parsed)) {
        return null;
      }
      raw = parsed;
    } catch {
      return null;
    }
  } else {
    raw = input;
  }
  if (!('fw' in raw) && !('proto' in raw) && !('prod' in raw)) {
    return null;
  }
  const proto = str(raw.proto);
  const legacy = proto === null;
  const ch = !legacy && isObj(raw.ch) ? raw.ch : null;
  const selfTest: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) {
    if (!['proto', 'prod', 'hw', 'fw', 'ver', 'ch'].includes(k)) {
      selfTest[k] = raw[k];
    }
  }

  let modules: DeviceModules;
  if (legacy || !ch) {
    const groups: LraGroup[] = [
      { id: 'A', index: 0, label: DEFAULT_LRA_LABELS.A },
      { id: 'B', index: 1, label: DEFAULT_LRA_LABELS.B },
    ];
    modules = {
      wings: { groups, freq: { ...LRA_FREQ_FALLBACK }, lpulse: legacy ? null : { ...LPULSE_FALLBACK } },
      vcm: legacy ? { ...LEGACY_VCM } : { ...LEGACY_VCM, command: 'VHZ' },
      ppg: parsePpg(undefined, raw.ppg),
      egg: null,
    };
  } else {
    const groups = parseLraGroups(ch.lra);
    const fr = parseRange(ch.freq);
    const freq = fr
      ? { min: fr.min, max: fr.max, def: clamp(fr.def ?? LRA_FREQ_FALLBACK.def, fr.min, fr.max) }
      : { ...LRA_FREQ_FALLBACK };
    const lp = parseRange(ch.lpulse);
    const lpulse: LpulseCaps = lp ? { minMs: lp.min, maxMs: lp.max } : { ...LPULSE_FALLBACK };
    const vr = parseRange(ch.vhz);
    const vcm: VcmCaps | null = vr
      ? {
          minHz: vr.min,
          maxHz: vr.max,
          defaultHz: clamp(vr.def ?? VCM_DEFAULT_HZ, vr.min, vr.max),
          command: 'VHZ',
        }
      : null; // v0 without ch.vhz = no voice coil on this unit
    let egg: EggCaps | null = null;
    if (isObj(ch.egg)) {
      const idx = num(ch.egg.ppg);
      if (idx !== null) {
        egg = { ppgIndex: idx, hasActuator: flag(ch.egg.act) };
      }
    }
    modules = {
      wings: groups.length ? { groups, freq, lpulse } : null,
      vcm,
      ppg: parsePpg(ch.ppg, raw.ppg),
      egg,
    };
  }

  return {
    proto,
    legacy,
    prod: str(raw.prod),
    hw: str(raw.hw),
    fw: str(raw.fw),
    ver: str(raw.ver),
    modules,
    safety: parseSafety(ch),
    selfTest,
    raw,
  };
}

// ---------------------------------------------------------------- TLM

export interface PpgReading {
  ir: number;
  contact: boolean;
  /** null while firmware reports 0 (not computed yet). */
  hr: number | null;
}

export interface Telemetry {
  /** 'v0' when the frame has `vhz`, 'legacy' when it only has `vcm`. */
  format: 'v0' | 'legacy';
  t: number | null;
  ppg: PpgReading[];
  fsr: number[];
  hall: number | null;
  /** null when firmware reports -99 (not wired / out of range). */
  ntcC: number | null;
  /** null when not measured (< 1.0 V, e.g. no battery fitted). */
  vbat: number | null;
  batteryPct: number | null;
  acc: number[];
  gyr: number[];
  /** Actual intensities [A (J10), B (J11)], 0–100. */
  lra: [number, number];
  /** Wing rhythm per group [[onMs,offMs],[onMs,offMs]]; [0,0] = constant. Legacy: always [0,0]. */
  lp: [[number, number], [number, number]];
  lraFreqHz: number | null;
  /** Voice-coil pulse: hz is the beat frequency (legacy converted from half-period). */
  vcm: { on: boolean; hz: number | null };
  auto: boolean;
  estop: boolean;
  /** Over-temperature latch (v0 `ot`; absent on legacy -> false). */
  ot: boolean;
  /** Low-battery latch (v0 `lb`; null when the frame does not carry it, i.e. legacy). */
  lb: boolean | null;
}

/** Battery % from vbat via the installed curve (piecewise linear, clamped). */
export function batteryPercent(vbat: number | null, curve: BatteryCurve = batteryCurve): number | null {
  if (vbat === null || vbat < VBAT_VALID_MIN) {
    return null;
  }
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (vbat <= first[0]) {
    return Math.round(clamp(first[1], 0, 100));
  }
  if (vbat >= last[0]) {
    return Math.round(clamp(last[1], 0, 100));
  }
  for (let i = 1; i < curve.length; i++) {
    const [v1, p1] = curve[i];
    if (vbat <= v1) {
      const [v0, p0] = curve[i - 1];
      return Math.round(clamp(p0 + ((vbat - v0) / (v1 - v0)) * (p1 - p0), 0, 100));
    }
  }
  return Math.round(clamp(last[1], 0, 100));
}

export function halfMsToHz(halfMs: number): number {
  return halfMs > 0 ? Math.round((500 / halfMs) * 10) / 10 : 0;
}

function pair(v: unknown): [number, number] {
  const a = Array.isArray(v) ? v : [];
  return [num(a[0]) ?? 0, num(a[1]) ?? 0];
}

/**
 * Parse a telemetry frame. Format is decided by field presence (§7.3):
 * `vhz` present => v0 (Hz, 0 = off); only `vcm` => H11 v1.0 `[on, halfMs]`.
 */
export function parseTelemetry(obj: Json): Telemetry {
  const ppg: PpgReading[] = Array.isArray(obj.ppg)
    ? obj.ppg.map(e => {
        const a = Array.isArray(e) ? e : [];
        const hr = num(a[2]);
        return { ir: num(a[0]) ?? 0, contact: flag(a[1]), hr: hr && hr > 0 ? hr : null };
      })
    : [];
  const ntc = num(obj.ntc);
  const vbatRaw = num(obj.vbat);
  const vbat = vbatRaw !== null && vbatRaw >= VBAT_VALID_MIN ? vbatRaw : null;
  const lra = numArr(obj.lra);
  const isV0 = 'vhz' in obj;
  let vcm: { on: boolean; hz: number | null };
  if (isV0) {
    const hz = num(obj.vhz);
    vcm = { on: (hz ?? 0) > 0, hz: hz !== null && hz > 0 ? hz : 0 };
  } else {
    const a = Array.isArray(obj.vcm) ? obj.vcm : [];
    const ms = num(a[1]);
    vcm = { on: flag(a[0]), hz: ms !== null ? halfMsToHz(ms) : null };
  }
  const lpArr = Array.isArray(obj.lp) ? obj.lp : [];
  return {
    format: isV0 ? 'v0' : 'legacy',
    t: num(obj.t),
    ppg,
    fsr: numArr(obj.fsr),
    hall: num(obj.hall),
    ntcC: ntc === null || ntc <= -99 ? null : ntc,
    vbat,
    batteryPct: batteryPercent(vbat),
    acc: numArr(obj.acc),
    gyr: numArr(obj.gyr),
    lra: [lra[0] ?? 0, lra[1] ?? 0],
    lp: [pair(lpArr[0]), pair(lpArr[1])],
    lraFreqHz: num(obj.f),
    vcm,
    auto: flag(obj.auto),
    estop: flag(obj.estop),
    ot: flag(obj.ot),
    lb: 'lb' in obj ? flag(obj.lb) : null,
  };
}

// ---------------------------------------------------------------- lines

export type ParsedLine =
  | { kind: 'tlm'; tlm: Telemetry }
  | { kind: 'info'; info: DeviceInfo }
  | { kind: 'ok'; text: string; args: string[] }
  | { kind: 'err'; text: string; args: string[] }
  | { kind: 'evt'; name: string; args: string[]; text: string }
  | { kind: 'unknown'; text: string };

/** Classify one reassembled TLM line: telemetry JSON, INFO JSON, OK/ERR reply, EVT. */
export function parseLine(line: string): ParsedLine {
  const text = line.trim();
  if (text.startsWith('{')) {
    let obj: unknown;
    try {
      obj = JSON.parse(text);
    } catch {
      return { kind: 'unknown', text };
    }
    if (!isObj(obj)) {
      return { kind: 'unknown', text };
    }
    if ('lra' in obj || 't' in obj) {
      return { kind: 'tlm', tlm: parseTelemetry(obj) };
    }
    const info = parseInfo(obj);
    return info ? { kind: 'info', info } : { kind: 'unknown', text };
  }
  const parts = text.split(/\s+/);
  const head = parts[0].toUpperCase();
  if (head === 'OK') {
    return { kind: 'ok', text, args: parts.slice(1) };
  }
  if (head === 'ERR') {
    return { kind: 'err', text, args: parts.slice(1) };
  }
  if (head === 'EVT') {
    return { kind: 'evt', name: (parts[1] || '').toUpperCase(), args: parts.slice(2), text };
  }
  return { kind: 'unknown', text };
}

/** Firmware safety rejections (§7.5), in firmware priority order. */
export type SafetyErr = 'ESTOP' | 'OVERTEMP' | 'LOWBAT';

export function safetyErrOf(p: ParsedLine): SafetyErr | null {
  if (p.kind !== 'err') {
    return null;
  }
  const a = (p.args[0] || '').toUpperCase();
  return a === 'ESTOP' || a === 'OVERTEMP' || a === 'LOWBAT' ? a : null;
}

// ---------------------------------------------------------------- commands

export type LraTarget = LraGroupId | 'ALL';

function int(v: number): number {
  return Math.round(Number.isFinite(v) ? v : 0);
}

/** Target token: `0` / `1` / `BOTH` are valid on both H11 v1.0 and v0 (§7.1). */
function targetToken(target: LraTarget): string {
  return target === 'A' ? '0' : target === 'B' ? '1' : 'BOTH';
}

/** `LRA t v` — constant vibration; also cancels LPULSE rhythm on that group. */
export function formatLra(target: LraTarget, value: number): string {
  const v = clamp(int(value), LRA_MIN, LRA_MAX);
  return `LRA ${targetToken(target)} ${v}`;
}

/** `LPULSE t v onMs offMs` (§7.7), on/off clamped to the INFO ch.lpulse range. */
export function formatLpulse(
  target: LraTarget,
  value: number,
  onMs: number,
  offMs: number,
  caps: LpulseCaps = LPULSE_FALLBACK,
): string {
  const v = clamp(int(value), LRA_MIN, LRA_MAX);
  const lo = Math.ceil(caps.minMs);
  const hi = Math.floor(caps.maxMs);
  return `LPULSE ${targetToken(target)} ${v} ${clamp(int(onMs), lo, hi)} ${clamp(int(offMs), lo, hi)}`;
}

export function formatFreq(hz: number, range: { min: number; max: number } = LRA_FREQ_FALLBACK): string {
  return `FREQ ${clamp(int(hz), Math.ceil(range.min), Math.floor(range.max))}`;
}

/** Clamp a requested beat frequency to what the device reported. 0 / negative = off. */
export function clampVcmHz(hz: number, caps: Pick<VcmCaps, 'minHz' | 'maxHz'>): number {
  if (!Number.isFinite(hz) || hz <= 0) {
    return 0;
  }
  return clamp(int(hz), Math.ceil(caps.minHz), Math.floor(caps.maxHz));
}

const VCM_LEGACY_HZ_CAPS = { minHz: VCM_LEGACY_HZ.min, maxHz: VCM_LEGACY_HZ.max };

/** Legacy mapping: half-period ms = 500 / Hz, clamped to 25–250 ms and to caps. */
export function vcmHzToHalfMs(
  hz: number,
  caps: Pick<VcmCaps, 'minHz' | 'maxHz'> = VCM_LEGACY_HZ_CAPS,
): number {
  const minMs = Math.max(VCM_LEGACY_HALF_MS.min, Math.ceil(500 / caps.maxHz));
  const maxMs = Math.min(VCM_LEGACY_HALF_MS.max, Math.floor(500 / caps.minHz));
  return clamp(Math.round(500 / hz), minMs, maxMs);
}

/**
 * Voice-coil pulse: beat frequency (Hz) is the intensity control. 0 = off.
 * v0 -> `VHZ hz`; legacy firmware -> `VCM 1 halfMs` / `VCM 0`.
 * Never emits out-of-range values.
 */
export function formatVcmHz(hz: number, caps: VcmCaps): string {
  const h = clampVcmHz(hz, caps);
  if (caps.command === 'VHZ') {
    return `VHZ ${h}`;
  }
  if (h === 0) {
    return 'VCM 0';
  }
  return `VCM 1 ${vcmHzToHalfMs(h, caps)}`;
}

export const formatStop = (): string => 'STOP';
export const formatEstop = (on: boolean): string => (on ? 'ESTOP 1' : 'ESTOP 0');
export const formatRate = (hz: number): string => `RATE ${clamp(int(hz), 0, 20)}`;

/** Wire form: every command ends with `\n` (§7.4). */
export function encodeCommand(line: string): number[] {
  return encodeUtf8(`${line.replace(/[\r\n;]+$/g, '').trim()}\n`);
}
