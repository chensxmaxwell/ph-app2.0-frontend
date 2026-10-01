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
  SafetyThresholds,
  Telemetry,
  VcmCaps,
  batteryPercent,
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

/*
 * Over-temp / low-battery thresholds are NOT constants here (§8.4): they come
 * from INFO `ch.ot` / `ch.lb` via `info.safety` (protocol.ts falls back to
 * OT_FALLBACK / LB_FALLBACK only when INFO lacks them, i.e. legacy boards).
 * Display rule (design review 2026-10-01): a number is shown only if it came
 * from the device: a threshold only when `safety.fromInfo` says INFO carried
 * it, a reading only when telemetry has it. Fallbacks feed the client-side
 * legacy trip logic only and are never displayed.
 */

/**
 * App-side copy for the wing groups (§8.5, electrical mapping locked):
 * A (J10) = left + right upper wings, B (J11) = left + right lower wings.
 * Independent of the INFO labels (which are 上翼 / 下翼 and may be localised).
 */
export type WingZone = 'upper' | 'lower';
export const WING_GROUP_COPY: Record<
  'A' | 'B',
  { zone: WingZone; name: string; short: string; detail: string }
> = {
  A: { zone: 'upper', name: 'Upper wings', short: 'Upper', detail: 'left + right' },
  B: { zone: 'lower', name: 'Lower wings', short: 'Lower', detail: 'left + right' },
};
/** Product-image hotspot zones -> card (+ wing group for the two wing zones). */
export type HotspotZone = WingZone | 'head' | 'bullet';
export const HOTSPOT_ZONES: Record<HotspotZone, { card: 'wing' | 'vcm' | 'egg'; group?: 'A' | 'B' }> = {
  upper: { card: 'wing', group: 'A' },
  lower: { card: 'wing', group: 'B' },
  head: { card: 'vcm' },
  bullet: { card: 'egg' },
};
/** App-side cap for the voice-coil beat range (Maxwell 9/28: 10–50 Hz). */
export const VHZ_UI_MIN = 10;
export const VHZ_UI_MAX = 50;
/**
 * Wing (LRA) drive frequency is fixed at the device default and not exposed in
 * the UI (Maxwell, 2026-09-29: no Fine tune). The controller corrects a device
 * that reports anything else once per connection; see wingFreqCorrection().
 */
export const WING_FREQ_HZ = 170;
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

/**
 * Page notice (design v4 §1/§5: notice card = title + short body, same card
 * surface as the modules, full-white text). tone 'warn' for heat / battery,
 * 'neutral' for connection / E-stop / info. Copy follows design v4 (no em / en
 * dashes). Each string in `lines` renders as its own line.
 */
export interface BannerModel {
  tone: 'neutral' | 'warn';
  icon: 'lock' | 'thermometer' | 'battery' | 'bluetooth' | 'info';
  title: string;
  lines: string[];
  /** Optional action rendered as an outline button (Reconnect / Scan). */
  action?: 'reconnect' | 'scan';
}

const fmtC = (c: number) => `${Number.isInteger(c) ? c : c.toFixed(1)} °C`;

const ALSO_TEXT = (c: Condition, tlm: Telemetry | null): string => {
  switch (c) {
    case 'estop':
      return 'Stop all is also on.';
    case 'overtemp':
      return `Also too warm${tlm?.ntcC != null ? ` (${fmtC(tlm.ntcC)})` : ''}.`;
    case 'lowbat':
      return `Battery is also low${tlm?.vbat != null ? ` (${tlm.vbat.toFixed(2)} V)` : ''}.`;
  }
};

/**
 * Over-temp notice body. Reading = TLM `ntc` (ntcC), clear = INFO `ch.ot.clear`;
 * each part is omitted when the device did not provide it.
 */
export function overTempLine(ntcC: number | null, clearC: number | null): string {
  const reading = ntcC !== null ? `Device at ${fmtC(ntcC)}. ` : '';
  if (clearC === null) {
    return `${reading}Outputs resume once it cools down.`;
  }
  return ntcC !== null
    ? `${reading}Outputs resume once it cools below ${fmtC(clearC)}.`
    : `Outputs resume once the device cools below ${fmtC(clearC)}.`;
}

/** Only the highest-priority notice is shown; lower ones become extra lines. */
export function bannerFor(
  screen: ScreenState,
  tlm: Telemetry | null,
  estopSource: Icd001State['estopSource'],
  safety: Pick<SafetyThresholds, 'ot' | 'fromInfo'> | null = null,
  link: { hadDevice: boolean; stopQueued?: boolean } = { hadDevice: true },
): BannerModel | null {
  // Clear threshold only if INFO `ch.ot` carried it (never OT_FALLBACK).
  const otClear = safety?.fromInfo.ot ? safety.ot.clearC : null;
  const also = screen.also.map(c => ALSO_TEXT(c, tlm));
  switch (screen.kind) {
    case 'disconnected':
      if (!link.hadDevice) {
        return {
          tone: 'neutral',
          icon: 'bluetooth',
          title: screen.connecting ? 'Looking for your device' : 'Not connected',
          lines: ['Turn on ICD-001 and keep it close.'],
          action: 'scan',
        };
      }
      return {
        tone: 'neutral',
        icon: 'bluetooth',
        title: 'Connection lost',
        // Firmware stops everything on BLE drop (§5). Stop all pressed offline
        // is sent as ESTOP 1 first on reconnect (controller.stopAll).
        lines: link.stopQueued
          ? ['Everything stopped.', 'Stays stopped after reconnect.']
          : ['Everything stopped.'],
        action: 'reconnect',
      };
    case 'estop':
      return {
        tone: 'neutral',
        icon: 'lock',
        title: 'Everything is stopped',
        lines: [
          estopSource === 'device' ? 'Stopped with the button on the device.' : 'All outputs are off.',
          estopSource === 'device'
            ? 'Tap Unlock or press that button again.'
            : 'Tap Unlock when you are ready.',
          ...also,
        ],
      };
    case 'overtemp':
      return {
        tone: 'warn',
        icon: 'thermometer',
        title: 'Too warm, paused',
        lines: [overTempLine(tlm?.ntcC ?? null, otClear), ...also],
      };
    case 'lowbat':
      return {
        tone: 'warn',
        icon: 'battery',
        title: 'Battery low, paused',
        lines: [
          tlm?.vbat != null
            ? `${tlm.vbat.toFixed(2)} V. Charge the device to continue.`
            : 'Charge the device to continue.',
          ...also,
        ],
      };
    default:
      return null;
  }
}

export const COOLED_DOWN_BANNER: BannerModel = {
  tone: 'neutral',
  icon: 'info',
  title: 'Cooled down',
  lines: ['Turn modules back on when you are ready.'],
};
export const COOLED_DOWN_MS = 4000;

// ------------------------------------------------------------ device strip

/**
 * Battery % shown in the app = protocol `batteryPercent` (§8.1: provisional
 * linear 3.40 V = 0 %, 4.20 V = 100 %; swap the curve in protocol.ts when the
 * measured piecewise table arrives).
 */
export function displayBatteryPct(vbat: number | null): number | null {
  return batteryPercent(vbat);
}

/** Device-button release (§8.3): shown briefly after EVT ESTOP 0 from the START key. */
export const RELEASED_ON_DEVICE_BANNER: BannerModel = {
  tone: 'neutral',
  icon: 'info',
  title: 'Released on the device',
  lines: ['Outputs stay off. Turn modules back on when you are ready.'],
};
export const RELEASED_NOTICE_MS = 4000;

export function tempText(ntcC: number | null): string {
  return ntcC === null ? 'n/a' : `${ntcC.toFixed(1)}°C`;
}

// ------------------------------------------------------------ cards from INFO

export interface WingGroupView extends LraGroup {
  /** App-side copy + hotspot zone (§8.5), not the INFO label. */
  zone: WingZone;
  name: string;
  short: string;
  detail: string;
}

export interface IntensityCard {
  id: 'wing';
  kind: 'intensity';
  label: string;
  /** App copy (design v2), never INFO labels (Q10). */
  subtitle: string;
  part: 'wings';
  groups: WingGroupView[];
  lpulse: LpulseCaps | null;
}

export interface RhythmCard {
  id: 'vcm';
  kind: 'rhythm';
  label: string;
  /** App copy (design v2), never INFO labels (Q10). */
  subtitle: string;
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
  /** App copy (design v2), never INFO labels (Q10). */
  subtitle: string;
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
      subtitle: 'Upper and lower pairs',
      part: 'wings',
      groups: w.groups.map(g => ({ ...g, ...WING_GROUP_COPY[g.id] })),
      lpulse: w.lpulse,
    });
  }
  const v = info.modules.vcm;
  if (v) {
    out.push({
      id: 'vcm',
      kind: 'rhythm',
      label: 'Pulse',
      subtitle: 'Voice coil rhythm',
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
      subtitle: e.hasActuator ? 'Sensor and vibration' : 'Sensor only',
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

/**
 * FREQ to send once after connect/INFO so the wings run at WING_FREQ_HZ, or
 * null when the device already reports it (TLM `f` when present, else INFO
 * `ch.freq.def`) or has no wings.
 */
export function wingFreqCorrection(info: DeviceInfo | null, tlmFreqHz?: number | null): ClientCall | null {
  const wings = info?.modules.wings;
  if (!wings) {
    return null;
  }
  const current = tlmFreqHz || wings.freq.def;
  return current === WING_FREQ_HZ ? null : { fn: 'setFreq', hz: WING_FREQ_HZ };
}

export interface WingCtx {
  link: boolean;
  mode: 'steady' | 'rhythm';
  rhythm: RhythmPresetId;
  /** Last non-zero intensities, restored when the switch turns on. */
  values: { A: number; B: number };
  groups: LraGroupId[];
}
type LraGroupId = 'A' | 'B';

export type ControlAction =
  | { t: 'wingSlider'; group: LraGroupId | 'ALL'; value: number }
  | { t: 'wingSwitch'; on: boolean }
  | { t: 'wingMode'; mode: 'steady' | 'rhythm' }
  | { t: 'wingRhythm'; preset: RhythmPresetId }
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
