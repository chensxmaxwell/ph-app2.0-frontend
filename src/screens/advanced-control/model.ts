/**
 * 高级控制 (Advanced control) page model: pure functions, no React Native, so
 * the state priority and the control -> command mapping are unit-tested.
 *
 * Design: /workspace/ph-icd001-advanced-control/design-v1/spec.md
 * Protocol: /workspace/firmware/PROTOCOL-ICD001.md (§7 overrides the spec's open questions)
 */
import {
  DeviceInfo,
  LpulseCaps,
  LraGroup,
  LraTarget,
  Telemetry,
  VBAT_FULL,
  VBAT_LOW_CUT,
  VcmCaps,
  clamp,
  formatEstop,
  formatFreq,
  formatLpulse,
  formatLra,
  formatStop,
  formatVcmHz,
} from '../../services/icd001/protocol';

import type { Icd001State } from '../../services/icd001/client';

// ------------------------------------------------------------ constants

/** Over-temp thresholds (PROTOCOL §5, provisional; spec Q12: never hard-code in copy). */
export const OT_TRIP_C = 42;
export const OT_RELEASE_C = 39;
/** App-side cap for the voice-coil beat range (Maxwell 9/28: 10–50 Hz). */
export const VHZ_UI_MIN = 10;
export const VHZ_UI_MAX = 50;
export const FREQ_STEP_HZ = 5;
/** Wing rhythm presets (spec Q6 not answered: v1 ships presets, not raw ms). */
export const RHYTHM_PRESETS = [
  { id: 'slow', label: 'Slow', onMs: 800, offMs: 800 },
  { id: 'medium', label: 'Medium', onMs: 400, offMs: 400 },
  { id: 'fast', label: 'Fast', onMs: 150, offMs: 150 },
] as const;
export type RhythmPresetId = (typeof RHYTHM_PRESETS)[number]['id'];

// ------------------------------------------------------------ state priority

export type ScreenKind = 'disconnected' | 'estop' | 'overtemp' | 'lowbat' | 'normal';
export type Condition = 'estop' | 'overtemp' | 'lowbat';

export interface ScreenState {
  /** Highest-priority state: 未连接 > 急停 > 过温 > 低电 > 正常. */
  kind: ScreenKind;
  /** Scanning / connecting / reconnecting (a sub-state of disconnected). */
  connecting: boolean;
  /** Lower-priority conditions that are also active (extra banner lines). */
  also: Condition[];
  /** Actuator controls usable (normal state, INFO read, telemetry fresh). */
  controlsEnabled: boolean;
  /** Connected but waiting for telemetry. */
  waiting: boolean;
}

type StateSlice = Pick<Icd001State, 'status' | 'estop' | 'overTemp' | 'lowBattery' | 'info' | 'lockReasons'>;

export function deriveScreenState(s: StateSlice): ScreenState {
  const connected = s.status === 'connected';
  const connecting = s.status === 'scanning' || s.status === 'connecting' || s.status === 'reconnecting';
  const active: Condition[] = [];
  if (s.estop) {
    active.push('estop');
  }
  if (s.overTemp) {
    active.push('overtemp');
  }
  if (s.lowBattery) {
    active.push('lowbat');
  }
  if (!connected) {
    return { kind: 'disconnected', connecting, also: [], controlsEnabled: false, waiting: false };
  }
  const kind: ScreenKind = active.length ? active[0] : 'normal';
  const waiting = s.lockReasons.includes('stale') || s.lockReasons.includes('noinfo');
  return {
    kind,
    connecting: false,
    also: active.slice(1),
    controlsEnabled: kind === 'normal' && !waiting && !!s.info,
    waiting,
  };
}

export interface BannerModel {
  tone: 'red' | 'amber';
  icon: 'hand' | 'therm' | 'bolt' | 'check';
  title: string;
  lines: string[];
}

const ALSO_TEXT = (c: Condition, tlm: Telemetry | null): string => {
  switch (c) {
    case 'estop':
      return 'Emergency stop is also on.';
    case 'overtemp':
      return `Also too warm${tlm?.ntcC != null ? ` (${tlm.ntcC.toFixed(1)}°C)` : ''}.`;
    case 'lowbat':
      return `Battery is also low${tlm?.vbat != null ? ` (${tlm.vbat.toFixed(2)} V)` : ''}.`;
  }
};

/** Only the highest-priority banner is shown; others become extra lines. */
export function bannerFor(
  screen: ScreenState,
  tlm: Telemetry | null,
  estopSource: Icd001State['estopSource'],
): BannerModel | null {
  const also = screen.also.map(c => ALSO_TEXT(c, tlm));
  switch (screen.kind) {
    case 'estop':
      return {
        tone: 'red',
        icon: 'hand',
        title: 'Emergency stop is on',
        lines: [
          `All outputs are off. Stopped from ${estopSource === 'device' ? 'the device button' : 'the app'}.`,
          'Hold the button below to release.',
          ...also,
        ],
      };
    case 'overtemp':
      return {
        tone: 'amber',
        icon: 'therm',
        title: `Too warm${tlm?.ntcC != null ? ` · ${tlm.ntcC.toFixed(1)}°C` : ''}`,
        lines: [
          `Outputs paused to protect your skin. They can start again below ${OT_RELEASE_C}°C.`,
          ...also,
        ],
      };
    case 'lowbat':
      return {
        tone: 'amber',
        icon: 'bolt',
        title: `Battery low${tlm?.vbat != null ? ` · ${tlm.vbat.toFixed(2)} V` : ''}`,
        lines: ['Outputs paused. Charge ICD-001 to keep going.', ...also],
      };
    default:
      return null;
  }
}

export const COOLED_DOWN_BANNER: BannerModel = {
  tone: 'amber',
  icon: 'check',
  title: 'Cooled down — turn modules back on',
  lines: [],
};
export const COOLED_DOWN_MS = 4000;

// ------------------------------------------------------------ device strip

/**
 * Battery % shown in the app. Open question (spec Q7) answered with an app
 * default: 0% = the firmware cut-off 3.40 V (not 3.50 V), 100% = 4.20 V, so the
 * user never sees "0%" while the device still runs. Pending a discharge curve.
 */
export const VBAT_DISPLAY_EMPTY = VBAT_LOW_CUT;

export function displayBatteryPct(vbat: number | null): number | null {
  if (vbat === null) {
    return null;
  }
  return Math.round(clamp(((vbat - VBAT_DISPLAY_EMPTY) / (VBAT_FULL - VBAT_DISPLAY_EMPTY)) * 100, 0, 100));
}

export function tempText(ntcC: number | null): string {
  return ntcC === null ? '—' : `${ntcC.toFixed(1)}°C`;
}

// ------------------------------------------------------------ cards from INFO

export interface IntensityCard {
  id: 'wing';
  kind: 'intensity';
  label: string;
  part: 'wings';
  groups: LraGroup[];
  freq: { min: number; max: number; def: number };
  lpulse: LpulseCaps | null;
}

export interface RhythmCard {
  id: 'vcm';
  kind: 'rhythm';
  label: string;
  part: 'head';
  /** Slider range used by the app (INFO ch.vhz capped to 10–50; legacy 2–20). */
  range: { min: number; max: number; def: number };
  /** Range the device itself reported. */
  device: { min: number; max: number };
  caps: VcmCaps;
}

export interface SensorCard {
  id: 'egg';
  kind: 'sensor';
  label: string;
  part: 'bullet';
  ppgIndex: number;
  hasActuator: boolean;
}

export type ModuleCard = IntensityCard | RhythmCard | SensorCard;

export function rhythmRange(caps: VcmCaps): { min: number; max: number; def: number } {
  let min = caps.minHz;
  let max = caps.maxHz;
  if (caps.command === 'VHZ') {
    const lo = Math.max(caps.minHz, VHZ_UI_MIN);
    const hi = Math.min(caps.maxHz, VHZ_UI_MAX);
    if (lo <= hi) {
      min = lo;
      max = hi;
    }
  }
  return { min, max, def: clamp(caps.defaultHz, min, max) };
}

export function rhythmPresets(r: { min: number; max: number; def: number }): {
  soft: number;
  medium: number;
  strong: number;
} {
  const span = r.max - r.min;
  const soft = Math.round(r.min + span * 0.1);
  const strong = Math.round(r.max - span * 0.1);
  const medium = r.def > soft && r.def < strong ? Math.round(r.def) : Math.round((r.min + r.max) / 2);
  return { soft, medium, strong };
}

/** Nearest preset name for the card summary ("30 Hz · Medium"). */
export function beatLabel(hz: number, p: ReturnType<typeof rhythmPresets>): 'Soft' | 'Medium' | 'Strong' {
  const d = [
    ['Soft', Math.abs(hz - p.soft)],
    ['Medium', Math.abs(hz - p.medium)],
    ['Strong', Math.abs(hz - p.strong)],
  ] as const;
  return d.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

/** Cards follow INFO (never hard-coded): order lra → vhz → egg as in the locked ch table. */
export function buildCards(info: DeviceInfo | null): ModuleCard[] {
  if (!info) {
    return [];
  }
  const out: ModuleCard[] = [];
  const w = info.modules.wings;
  if (w && w.groups.length) {
    out.push({
      id: 'wing',
      kind: 'intensity',
      label: 'Wings',
      part: 'wings',
      groups: w.groups,
      freq: w.freq,
      lpulse: w.lpulse,
    });
  }
  const v = info.modules.vcm;
  if (v) {
    out.push({
      id: 'vcm',
      kind: 'rhythm',
      label: 'Pulse',
      part: 'head',
      range: rhythmRange(v),
      device: { min: v.minHz, max: v.maxHz },
      caps: v,
    });
  }
  const e = info.modules.egg;
  if (e) {
    out.push({
      id: 'egg',
      kind: 'sensor',
      label: 'Bullet',
      part: 'bullet',
      ppgIndex: e.ppgIndex,
      hasActuator: e.hasActuator,
    });
  }
  return out;
}

export function groupsTag(n: number): string {
  return n === 1 ? '1 GROUP' : `${n} GROUPS`;
}

// ------------------------------------------------------------ summaries

export interface SensorReading {
  available: boolean;
  contact: boolean;
  hr: number | null;
}

export function sensorReading(tlm: Telemetry | null, card: SensorCard): SensorReading {
  const p = tlm?.ppg[card.ppgIndex];
  if (!p) {
    return { available: false, contact: false, hr: null };
  }
  return { available: true, contact: p.contact, hr: p.hr };
}

export function sensorSummary(r: SensorReading): { strong: string; rest: string } {
  if (!r.available) {
    return { strong: '', rest: 'No sensor data' };
  }
  if (!r.contact) {
    return { strong: 'Not detected', rest: '' };
  }
  return { strong: 'On skin', rest: r.hr ? ` · ${r.hr} bpm` : ' · Measuring…' };
}

// ------------------------------------------------------------ control -> command mapping

export type ClientCall =
  | { fn: 'setLra'; target: LraTarget; value: number }
  | { fn: 'setLpulse'; target: LraTarget; value: number; onMs: number; offMs: number }
  | { fn: 'setFreq'; hz: number }
  | { fn: 'setVcmHz'; hz: number }
  | { fn: 'setEstop'; on: boolean }
  | { fn: 'stop' };

export interface WingCtx {
  link: boolean;
  mode: 'steady' | 'rhythm';
  rhythm: RhythmPresetId;
  /** Last non-zero intensities, restored when the switch turns on. */
  values: { A: number; B: number };
  freq: number;
  groups: LraGroupId[];
  freqRange: { min: number; max: number };
}
type LraGroupId = 'A' | 'B';

export type ControlAction =
  | { t: 'wingSlider'; group: LraGroupId | 'ALL'; value: number }
  | { t: 'wingSwitch'; on: boolean }
  | { t: 'wingMode'; mode: 'steady' | 'rhythm' }
  | { t: 'wingRhythm'; preset: RhythmPresetId }
  | { t: 'freqStep'; delta: number }
  | { t: 'pulseSlider'; hz: number }
  | { t: 'pulsePreset'; hz: number }
  | { t: 'pulseSwitch'; on: boolean; lastHz: number }
  | { t: 'stopAll' }
  | { t: 'release' }
  | { t: 'leave' };

function rhythmOf(id: RhythmPresetId) {
  return RHYTHM_PRESETS.find(r => r.id === id) ?? RHYTHM_PRESETS[1];
}

function wingCall(ctx: WingCtx, target: LraTarget, value: number): ClientCall {
  if (ctx.mode === 'rhythm' && value > 0) {
    const r = rhythmOf(ctx.rhythm);
    return { fn: 'setLpulse', target, value, onMs: r.onMs, offMs: r.offMs };
  }
  return { fn: 'setLra', target, value };
}

function wingAll(ctx: WingCtx): ClientCall[] {
  if (ctx.link || ctx.values.A === ctx.values.B) {
    return [wingCall(ctx, 'ALL', ctx.values.A)];
  }
  return ctx.groups.map(g => wingCall(ctx, g, ctx.values[g]));
}

/**
 * Map a UI control to client calls (spec §7). Throttling (~10 Hz, ≤20 cmd/s,
 * latest wins) happens in the client's CommandScheduler.
 */
export function mapAction(a: ControlAction, ctx: { wing?: WingCtx; pulse?: RhythmCard }): ClientCall[] {
  switch (a.t) {
    case 'wingSlider':
      if (!ctx.wing) {
        return [];
      }
      return [wingCall(ctx.wing, ctx.wing.link ? 'ALL' : a.group, clamp(Math.round(a.value), 0, 100))];
    case 'wingSwitch':
      if (!ctx.wing) {
        return [];
      }
      // off -> LRA ALL 0 (sent as `LRA BOTH 0`); on -> restore last A/B values
      return a.on ? wingAll(ctx.wing) : [{ fn: 'setLra', target: 'ALL', value: 0 }];
    case 'wingMode':
    case 'wingRhythm': {
      if (!ctx.wing) {
        return [];
      }
      const next: WingCtx =
        a.t === 'wingMode'
          ? { ...ctx.wing, mode: a.mode }
          : { ...ctx.wing, mode: 'rhythm', rhythm: a.preset };
      const running = next.values.A > 0 || next.values.B > 0;
      return running ? wingAll(next) : [];
    }
    case 'freqStep':
      if (!ctx.wing) {
        return [];
      }
      return [
        { fn: 'setFreq', hz: clamp(ctx.wing.freq + a.delta, ctx.wing.freqRange.min, ctx.wing.freqRange.max) },
      ];
    case 'pulseSlider':
    case 'pulsePreset': {
      if (!ctx.pulse) {
        return [];
      }
      const { min, max } = ctx.pulse.range;
      return [{ fn: 'setVcmHz', hz: clamp(Math.round(a.hz), min, max) }];
    }
    case 'pulseSwitch': {
      if (!ctx.pulse) {
        return [];
      }
      const { min, max, def } = ctx.pulse.range;
      const hz = a.lastHz > 0 ? clamp(a.lastHz, min, max) : def;
      return [{ fn: 'setVcmHz', hz: a.on ? hz : 0 }];
    }
    case 'stopAll':
      return [{ fn: 'setEstop', on: true }];
    case 'release':
      return [{ fn: 'setEstop', on: false }];
    case 'leave':
      return [{ fn: 'stop' }];
  }
}

/** Wire text a call produces (what the firmware receives, before `\n`). */
export function callToWire(c: ClientCall, info: DeviceInfo): string {
  switch (c.fn) {
    case 'setLra':
      return formatLra(c.target, c.value);
    case 'setLpulse':
      return formatLpulse(c.target, c.value, c.onMs, c.offMs, info.modules.wings?.lpulse ?? undefined);
    case 'setFreq':
      return formatFreq(c.hz, info.modules.wings?.freq);
    case 'setVcmHz':
      return info.modules.vcm ? formatVcmHz(c.hz, info.modules.vcm) : `VHZ ${c.hz}`;
    case 'setEstop':
      return formatEstop(c.on);
    case 'stop':
      return formatStop();
  }
}

/** Minimal client surface the page uses (Icd001Client satisfies it). */
export interface ControlClient {
  setLra(t: LraTarget, v: number): boolean;
  setLpulse(t: LraTarget, v: number, onMs: number, offMs: number): boolean;
  setFreq(hz: number): boolean;
  setVcmHz(hz: number): boolean;
  setEstop(on: boolean): Promise<void>;
  stop(): Promise<void>;
}

export function runCalls(client: ControlClient, calls: ClientCall[]): void {
  for (const c of calls) {
    switch (c.fn) {
      case 'setLra':
        client.setLra(c.target, c.value);
        break;
      case 'setLpulse':
        client.setLpulse(c.target, c.value, c.onMs, c.offMs);
        break;
      case 'setFreq':
        client.setFreq(c.hz);
        break;
      case 'setVcmHz':
        client.setVcmHz(c.hz);
        break;
      case 'setEstop':
        client.setEstop(c.on).catch(() => undefined);
        break;
      case 'stop':
        client.stop().catch(() => undefined);
        break;
    }
  }
}

/** Which stage parts are running (for highlight .45 + green dots). */
export function runningParts(tlm: Telemetry | null): { A: boolean; B: boolean; head: boolean } {
  return {
    A: !!tlm && tlm.lra[0] > 0,
    B: !!tlm && tlm.lra[1] > 0,
    head: !!tlm && tlm.vcm.on,
  };
}

export function wingSummary(tlm: Telemetry | null, groups: LraGroup[]): { parts: string[]; mode: string } {
  const lra = tlm?.lra ?? [0, 0];
  const lp = tlm?.lp ?? [
    [0, 0],
    [0, 0],
  ];
  const rhythm = groups.some(g => lp[g.index][0] > 0 && lra[g.index] > 0);
  return { parts: groups.map(g => `${g.id} ${lra[g.index]}`), mode: rhythm ? 'Rhythm' : 'Steady' };
}
