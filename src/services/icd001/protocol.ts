/**
 * ICD-001 / H1.1 BLE protocol: constants, line reassembly, INFO/TLM parsing,
 * command formatting. Pure TypeScript, no React Native imports, so it is unit
 * testable in Jest.
 *
 * Source of truth: /workspace/firmware/PROTOCOL-ICD001.md (v0 draft) on top of
 * /workspace/firmware/h11-demo-ble/PROTOCOL.md (H1.1 v1.0, what the dev board
 * H11-91B1 runs today).
 */
import { decodeUtf8 } from './utf8';

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
/** ATT payload with the default MTU of 23. Every command must fit in one write. */
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

/** Battery (PROTOCOL-ICD001 §4, rough linear estimate). */
export const VBAT_FULL = 4.2;
export const VBAT_EMPTY = 3.5;
/** Firmware low-battery cut (§5). The app locks controls at the same level. */
export const VBAT_LOW_CUT = 3.4;
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
  /** 'VHZ' = v0 `VHZ hz`; 'VCM' = legacy `VCM on halfMs` (h11-demo-ble today). */
  command: 'VHZ' | 'VCM';
}

export interface PpgChannel {
  index: number;
  label: string;
  present: boolean | null;
}

export interface EggCaps {
  ppgIndex: number;
  /** BOM has no actuator in the egg (§2 待拍板); UI greys out control when false. */
  hasActuator: boolean;
}

export interface DeviceModules {
  wings: {
    groups: LraGroup[];
    freq: { min: number; max: number; def: number };
  } | null;
  vcm: VcmCaps | null;
  ppg: PpgChannel[];
  egg: EggCaps | null;
}

export interface DeviceInfo {
  prod: string | null;
  hw: string | null;
  fw: string | null;
  ver: string | null;
  /** true when INFO carries a `ch` table (v0), false for legacy h11-demo-ble INFO. */
  hasChannelTable: boolean;
  /** Units of TLM `vcm[1]`: v0 reports Hz, legacy reports half-period ms. */
  vcmUnits: 'hz' | 'halfMs';
  modules: DeviceModules;
  selfTest: Record<string, unknown>;
  raw: Json;
}

const DEFAULT_LRA_LABELS: Record<LraGroupId, string> = { A: 'A 组', B: 'B 组' };

function parseLraGroups(v: unknown): LraGroup[] | null {
  if (v === undefined) {
    return null;
  }
  if (v === 0 || v === false || v === null) {
    return [];
  }
  const ids: LraGroupId[] = ['A', 'B'];
  const mk = (i: number, label: string | null): LraGroup => ({
    id: ids[i],
    index: i as 0 | 1,
    label: label || DEFAULT_LRA_LABELS[ids[i]],
  });
  if (typeof v === 'number') {
    return ids.slice(0, clamp(Math.floor(v), 0, 2)).map((_, i) => mk(i, null));
  }
  if (Array.isArray(v)) {
    return v.slice(0, 2).map((e, i) => {
      if (isObj(e)) {
        return mk(i, str(e.name) ?? str(e.label) ?? str(e.loc));
      }
      return mk(i, str(e));
    });
  }
  if (isObj(v)) {
    const out: LraGroup[] = [];
    ids.forEach((id, i) => {
      const e = v[id] ?? v[id.toLowerCase()] ?? v[String(i)];
      if (e === undefined || e === 0 || e === false) {
        return;
      }
      out.push(mk(i, isObj(e) ? str(e.name) ?? str(e.label) ?? str(e.loc) : str(e)));
    });
    return out;
  }
  return null;
}

function parseVcmRange(v: unknown): { min: number; max: number; def: number | null } | null | 'absent' {
  if (v === undefined) {
    return 'absent';
  }
  if (!isObj(v)) {
    return v === 0 || v === false ? null : 'absent';
  }
  const min = num(v.min);
  const max = num(v.max);
  if (min === null || max === null || min <= 0 || max < min) {
    return 'absent';
  }
  return { min, max, def: num(v.def ?? v.default) };
}

function parsePpg(v: unknown, selfTestPpg: unknown): PpgChannel[] {
  const present = Array.isArray(selfTestPpg) ? selfTestPpg.map(flag) : [];
  const mk = (index: number, label: string | null): PpgChannel => ({
    index,
    label: label || `PPG${index}`,
    present: index < present.length ? present[index] : null,
  });
  if (typeof v === 'number') {
    return Array.from({ length: Math.max(0, Math.floor(v)) }, (_, i) => mk(i, null));
  }
  if (Array.isArray(v)) {
    return v.map((e, i) => (isObj(e) ? mk(i, str(e.name) ?? str(e.label) ?? str(e.loc)) : mk(i, str(e))));
  }
  return present.map((_, i) => mk(i, null));
}

/**
 * Parse the INFO characteristic / `INFO` reply.
 *
 * v0 INFO (not yet in firmware): {"prod":"ICD-001","hw":"H1.1","fw":"…","ch":{…}}
 * with `ch.vcm = {"min":2,"max":50}`. The exact shape of the rest of `ch` is not
 * pinned down by the protocol draft, so this parser is tolerant (see
 * parseLraGroups / parsePpg) and falls back to the legacy H1.1 layout when `ch`
 * is missing.
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
  if (!('fw' in raw) && !('prod' in raw) && !('ch' in raw)) {
    return null;
  }
  const ch = isObj(raw.ch) ? raw.ch : null;
  const selfTest: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) {
    if (!['prod', 'hw', 'fw', 'ver', 'ch'].includes(k)) {
      selfTest[k] = raw[k];
    }
  }

  // Wings
  let groups = ch ? parseLraGroups(ch.lra) : null;
  if (groups === null) {
    // Legacy INFO or ch without lra: H1.1 always has J10 + J11 LRA outputs.
    groups = parseLraGroups(2) as LraGroup[];
  }
  let freq: { min: number; max: number; def: number } = {
    ...LRA_FREQ_FALLBACK,
  };
  const chFreq = ch && isObj(ch.freq) ? ch.freq : null;
  if (chFreq) {
    const mn = num(chFreq.min);
    const mx = num(chFreq.max);
    if (mn !== null && mx !== null && mx >= mn) {
      freq = {
        min: mn,
        max: mx,
        def: clamp(num(chFreq.def) ?? LRA_FREQ_FALLBACK.def, mn, mx),
      };
    }
  }
  const wings = groups.length ? { groups, freq } : null;

  // Voice coil / pulse (one actuator)
  const vr = ch ? parseVcmRange(ch.vcm) : 'absent';
  let vcm: VcmCaps | null;
  let vcmUnits: 'hz' | 'halfMs';
  if (vr === null) {
    vcm = null;
    vcmUnits = 'hz';
  } else if (vr === 'absent') {
    vcm = {
      minHz: VCM_LEGACY_HZ.min,
      maxHz: VCM_LEGACY_HZ.max,
      defaultHz: VCM_DEFAULT_HZ,
      command: 'VCM',
    };
    vcmUnits = 'halfMs';
  } else {
    vcm = {
      minHz: vr.min,
      maxHz: vr.max,
      defaultHz: clamp(vr.def ?? VCM_DEFAULT_HZ, vr.min, vr.max),
      command: 'VHZ',
    };
    vcmUnits = 'hz';
  }

  // Sensors
  const ppg = parsePpg(ch ? ch.ppg : undefined, raw.ppg);
  let egg: EggCaps | null = null;
  if (ch && isObj(ch.egg)) {
    const idx = num(ch.egg.ppg);
    egg = {
      ppgIndex: idx ?? 3,
      hasActuator: flag(ch.egg.act),
    };
  } else if (ch && ppg.length >= 4) {
    // §4: product has 4 PPG groups, the 4th is the egg.
    egg = { ppgIndex: 3, hasActuator: false };
  }

  return {
    prod: str(raw.prod),
    hw: str(raw.hw),
    fw: str(raw.fw),
    ver: str(raw.ver),
    hasChannelTable: ch !== null,
    vcmUnits,
    modules: { wings, vcm, ppg, egg },
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
  t: number | null;
  ppg: PpgReading[];
  fsr: number[];
  hall: number | null;
  /** null when firmware reports -99 (not wired / out of range). */
  ntcC: number | null;
  /** null when not measured (see VBAT_VALID_MIN). */
  vbat: number | null;
  batteryPct: number | null;
  acc: number[];
  gyr: number[];
  /** Actual intensities [A (J10), B (J11)], 0–100. */
  lra: [number, number];
  lraFreqHz: number | null;
  vcm: { on: boolean; hz: number | null };
  auto: boolean;
  estop: boolean;
  /** Over-temperature latch (v0, absent on legacy firmware -> false). */
  ot: boolean;
}

export function batteryPercent(vbat: number | null): number | null {
  if (vbat === null || vbat < VBAT_VALID_MIN) {
    return null;
  }
  return Math.round(clamp(((vbat - VBAT_EMPTY) / (VBAT_FULL - VBAT_EMPTY)) * 100, 0, 100));
}

export function halfMsToHz(halfMs: number): number {
  return halfMs > 0 ? Math.round((500 / halfMs) * 10) / 10 : 0;
}

export function parseTelemetry(obj: Json, vcmUnits: 'hz' | 'halfMs'): Telemetry {
  const ppg: PpgReading[] = Array.isArray(obj.ppg)
    ? obj.ppg.map(e => {
        const a = Array.isArray(e) ? e : [];
        const hr = num(a[2]);
        return {
          ir: num(a[0]) ?? 0,
          contact: flag(a[1]),
          hr: hr && hr > 0 ? hr : null,
        };
      })
    : [];
  const ntc = num(obj.ntc);
  const vbatRaw = num(obj.vbat);
  const vbat = vbatRaw !== null && vbatRaw >= VBAT_VALID_MIN ? vbatRaw : null;
  const lra = numArr(obj.lra);
  const vcmArr = Array.isArray(obj.vcm) ? obj.vcm : [];
  const vcmOn = flag(vcmArr[0]);
  const vcmVal = num(vcmArr[1]);
  let vcmHz: number | null = null;
  if (vcmVal !== null) {
    vcmHz = vcmUnits === 'hz' ? vcmVal : halfMsToHz(vcmVal);
  }
  return {
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
    lraFreqHz: num(obj.f),
    vcm: {
      on: vcmOn && (vcmUnits === 'halfMs' || (vcmHz ?? 0) > 0),
      hz: vcmHz,
    },
    auto: flag(obj.auto),
    estop: flag(obj.estop),
    ot: flag(obj.ot),
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
export function parseLine(line: string, vcmUnits: 'hz' | 'halfMs'): ParsedLine {
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
      return { kind: 'tlm', tlm: parseTelemetry(obj, vcmUnits) };
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
    return {
      kind: 'evt',
      name: (parts[1] || '').toUpperCase(),
      args: parts.slice(2),
      text,
    };
  }
  return { kind: 'unknown', text };
}

// ---------------------------------------------------------------- commands

export type LraTarget = LraGroupId | 'ALL';

function int(v: number): number {
  return Math.round(Number.isFinite(v) ? v : 0);
}

/**
 * `LRA t v`. Uses numeric targets `0`/`1` and `BOTH`, which mean the same on
 * legacy h11-demo-ble and on v0. NOTE: on legacy firmware the letter `B`
 * means BOTH, while v0 makes `B` = group B, so the app must never send `B`.
 */
export function formatLra(target: LraTarget, value: number): string {
  const v = clamp(int(value), LRA_MIN, LRA_MAX);
  const t = target === 'A' ? '0' : target === 'B' ? '1' : 'BOTH';
  return `LRA ${t} ${v}`;
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

const VCM_LEGACY_HZ_CAPS = {
  minHz: VCM_LEGACY_HZ.min,
  maxHz: VCM_LEGACY_HZ.max,
};

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
