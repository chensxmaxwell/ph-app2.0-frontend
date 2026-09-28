/**
 * Presentation-agnostic view-model for the 高级控制 page.
 *
 * Owns the UI-local state that is not on the device (expanded card, wing
 * link / mode / rhythm preset, last non-zero values to restore, optimistic
 * slider values, E-stop hold progress, transient messages) and turns
 * user intents into client calls via `mapAction` (throttled by the client's
 * CommandScheduler: ~10 Hz per key, latest value wins, ≤20 cmd/s).
 *
 * Visual design v2 renders `AdvancedControlView` and calls the intent
 * methods; nothing here knows about colours, layout or components.
 */
import {
  BannerModel,
  COOLED_DOWN_BANNER,
  COOLED_DOWN_MS,
  HOTSPOT_ZONES,
  HotspotZone,
  RELEASED_NOTICE_MS,
  RELEASED_ON_DEVICE_BANNER,
  ControlAction,
  ControlClient,
  FREQ_STEP_HZ,
  IntensityCard,
  ModuleCard,
  RhythmCard,
  RhythmPresetId,
  ScreenState,
  SensorCard,
  SensorReading,
  WingCtx,
  bannerFor,
  beatLabel,
  buildCards,
  deriveScreenState,
  displayBatteryPct,
  mapAction,
  rhythmPresets,
  runCalls,
  sensorReading,
  sensorSummary,
  tempText,
  wingSummary,
} from './model';

import type { Icd001State } from '../../services/icd001/client';
import type { DeviceInfo, LraGroupId, SafetyThresholds } from '../../services/icd001/protocol';
import type { DiscoveredDevice } from '../../services/icd001/transport';

export type CardId = ModuleCard['id'];
/** Product-image hotspot zones (§8.5: upper = group A, lower = group B). */
export type StagePart = HotspotZone;

/** Optimistic value wins over telemetry for this long after the last user input. */
export const OPTIMISTIC_MS = 800;
/** Non-safety ERR within this window after an input is attributed to it. */
export const ERR_ATTRIBUTION_MS = 1500;
export const RELEASE_HOLD_MS = 2000;
export const TOAST_MS = 3000;

export interface ClientLike extends ControlClient {
  getState(): Icd001State;
  subscribe(l: (s: Icd001State) => void): () => void;
  startScan(): Promise<void>;
  connect(d: DiscoveredDevice): Promise<boolean>;
  requestStopOnConnect(): void;
  stopForSafety(reason: string): void;
}

export interface IntensityView {
  kind: 'intensity';
  card: IntensityCard;
  expanded: boolean;
  enabled: boolean;
  /** Switch position: any group running. */
  on: boolean;
  values: Record<LraGroupId, number>;
  link: boolean;
  mode: 'steady' | 'rhythm';
  rhythm: RhythmPresetId;
  rhythmAvailable: boolean;
  freq: number;
  summary: string;
}

export interface RhythmView {
  kind: 'rhythm';
  card: RhythmCard;
  expanded: boolean;
  enabled: boolean;
  on: boolean;
  hz: number;
  presets: { soft: number; medium: number; strong: number };
  beat: 'Soft' | 'Medium' | 'Strong';
  summary: string;
}

export interface SensorView {
  kind: 'sensor';
  card: SensorCard;
  expanded: boolean;
  /** Sensor cards never grey out (read-only). */
  enabled: true;
  reading: SensorReading;
  summary: string;
  /** Egg actuator is not on the hardware yet: 待硬件 / "Needs hardware". */
  actuator: 'needs-hardware' | 'available';
}

export type CardView = IntensityView | RhythmView | SensorView;

export interface DeviceView {
  connected: boolean;
  name: string | null;
  lastName: string | null;
  tempText: string;
  tempWarn: boolean;
  vbat: number | null;
  batteryPct: number | null;
  batteryWarn: boolean;
}

export interface AdvancedControlView {
  screen: ScreenState;
  banner: BannerModel | null;
  device: DeviceView;
  /** Live module cards (empty when disconnected). */
  cards: CardView[];
  /** Disconnected: ghosted cards from the last INFO seen this session. */
  lastSeen: CardView[];
  scan: { scanning: boolean; connecting: boolean; devices: DiscoveredDevice[] };
  estop: {
    on: boolean;
    source: Icd001State['estopSource'];
    holdProgress: number;
    /** Last transition incl. device-button release (§8.3). */
    lastChange: Icd001State['estopChange'];
  };
  expanded: CardId | null;
  /** Wing group picked via the upper / lower hotspot (null = none). */
  focusedGroup: LraGroupId | null;
  /** Running zones (stage highlight / live dots): upper = A, lower = B (§8.5). */
  running: { upper: boolean; lower: boolean; head: boolean };
  /** Thresholds in use (INFO ch.ot / ch.lb, or fallback on legacy boards). */
  thresholds: SafetyThresholds | null;
  toast: string | null;
  /** STOP ALL pressed while offline; STOP goes out right after connecting. */
  stopQueued: boolean;
}

type Listener = () => void;

const CARD_NAME: Record<CardId, string> = { wing: 'Wings', vcm: 'Pulse', egg: 'Bullet' };

export class AdvancedControlController {
  private listeners = new Set<Listener>();
  private unsub: (() => void) | null = null;
  private view!: AdvancedControlView;
  private s: Icd001State;
  private lastInfo: DeviceInfo | null = null;
  private lastName: string | null = null;

  private expanded: CardId | null = null;
  private focusedGroup: LraGroupId | null = null;
  private seenEstopChangeAt: number | null = null;
  private releasedUntil = 0;
  private wing = {
    link: false,
    mode: 'steady' as 'steady' | 'rhythm',
    rhythm: 'medium' as RhythmPresetId,
    values: { A: 0, B: 0 } as Record<LraGroupId, number>,
    restore: { A: 50, B: 50 } as Record<LraGroupId, number>,
    freq: null as number | null,
  };
  private pulse = { hz: null as number | null, restore: 0 };
  private inputAt: Record<'A' | 'B' | 'vcm' | 'freq', number> = {
    A: -1e12,
    B: -1e12,
    vcm: -1e12,
    freq: -1e12,
  };
  private lastInput: { card: CardId; at: number } | null = null;
  private seenErrAt: number | null = null;
  private prevOverTemp = false;
  private cooledUntil = 0;
  private toast: { text: string; until: number } | null = null;
  private stopQueued = false;
  private holdStart: number | null = null;
  private holdTimer: ReturnType<typeof setInterval> | null = null;
  private msgTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly client: ClientLike, private readonly now: () => number = Date.now) {
    this.s = client.getState();
    this.seenErrAt = this.s.lastErr?.at ?? null;
    this.seenEstopChangeAt = this.s.estopChange?.at ?? null;
    this.absorb(this.s);
    this.recompute();
  }

  // ------------------------------------------------------------ store

  start(): void {
    if (!this.unsub) {
      this.unsub = this.client.subscribe(s => this.onState(s));
      this.onState(this.client.getState());
    }
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    this.cancelRelease();
    if (this.msgTimer) {
      clearTimeout(this.msgTimer);
    }
    this.listeners.clear();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getView = (): AdvancedControlView => this.view;

  // ------------------------------------------------------------ intents

  toggleCard(id: CardId): void {
    this.expanded = this.expanded === id ? null : id;
    this.focusedGroup = null;
    this.emit();
  }

  selectPart(part: StagePart): void {
    const z = HOTSPOT_ZONES[part];
    this.expanded = z.card;
    this.focusedGroup = z.group ?? null;
    this.emit();
  }

  collapse(): void {
    this.expanded = null;
    this.emit();
  }

  setWingValue(group: LraGroupId, value: number): void {
    const v = Math.round(Math.max(0, Math.min(100, value)));
    const groups: LraGroupId[] = this.wing.link ? ['A', 'B'] : [group];
    for (const g of groups) {
      this.wing.values[g] = v;
      this.inputAt[g] = this.now();
      if (v > 0) {
        this.wing.restore[g] = v;
      }
    }
    this.dispatch('wing', { t: 'wingSlider', group, value: v });
  }

  setWingOn(on: boolean): void {
    if (on) {
      this.wing.values = { ...this.wing.restore };
    } else {
      this.wing.values = { A: 0, B: 0 };
    }
    this.inputAt.A = this.inputAt.B = this.now();
    this.dispatch('wing', { t: 'wingSwitch', on });
  }

  toggleLink(): void {
    this.wing.link = !this.wing.link;
    if (this.wing.link && this.wing.values.A !== this.wing.values.B) {
      // Linking aligns B to A (one value drives both groups: LRA BOTH v).
      this.setWingValue('A', this.wing.values.A);
      return;
    }
    this.emit();
  }

  setWingMode(mode: 'steady' | 'rhythm'): void {
    this.wing.mode = mode;
    this.dispatch('wing', { t: 'wingMode', mode });
  }

  setWingRhythm(preset: RhythmPresetId): void {
    this.wing.mode = 'rhythm';
    this.wing.rhythm = preset;
    this.dispatch('wing', { t: 'wingRhythm', preset });
  }

  stepFreq(dir: 1 | -1): void {
    const w = this.wingCtx();
    if (!w) {
      return;
    }
    const calls = mapAction({ t: 'freqStep', delta: dir * FREQ_STEP_HZ }, { wing: w });
    const c = calls[0];
    if (c && c.fn === 'setFreq') {
      this.wing.freq = c.hz;
      this.inputAt.freq = this.now();
    }
    this.run('wing', calls);
  }

  setPulseHz(hz: number, preset = false): void {
    const card = this.card('vcm') as RhythmCard | undefined;
    if (!card) {
      return;
    }
    const v = Math.round(Math.max(card.range.min, Math.min(card.range.max, hz)));
    this.pulse.hz = v;
    this.pulse.restore = v;
    this.inputAt.vcm = this.now();
    this.dispatch('vcm', preset ? { t: 'pulsePreset', hz: v } : { t: 'pulseSlider', hz: v });
  }

  setPulseOn(on: boolean): void {
    const card = this.card('vcm') as RhythmCard | undefined;
    if (!card) {
      return;
    }
    const calls = mapAction({ t: 'pulseSwitch', on, lastHz: this.pulse.restore }, { pulse: card });
    const c = calls[0];
    if (c && c.fn === 'setVcmHz') {
      this.pulse.hz = c.hz;
      if (c.hz > 0) {
        this.pulse.restore = c.hz;
      }
    }
    this.inputAt.vcm = this.now();
    this.run('vcm', calls);
  }

  /** STOP ALL: ESTOP 1 when connected; offline -> STOP right after the next connect. */
  stopAll(): void {
    if (this.s.status === 'connected') {
      runCalls(this.client, mapAction({ t: 'stopAll' }, {}));
    } else {
      this.client.requestStopOnConnect();
      this.stopQueued = true;
    }
    this.emit();
  }

  /** Hold-to-release: call on press-in; ESTOP 0 is sent after RELEASE_HOLD_MS. */
  beginRelease(): void {
    if (!this.s.estop || this.holdStart !== null) {
      return;
    }
    this.holdStart = this.now();
    this.holdTimer = setInterval(() => {
      if (this.holdStart === null) {
        return;
      }
      if (this.now() - this.holdStart >= RELEASE_HOLD_MS) {
        this.cancelRelease(false);
        runCalls(this.client, mapAction({ t: 'release' }, {}));
      }
      this.emit();
    }, 50);
    this.emit();
  }

  /** Press-out before 2 s cancels. */
  cancelRelease(emit = true): void {
    if (this.holdTimer) {
      clearInterval(this.holdTimer);
    }
    this.holdTimer = null;
    this.holdStart = null;
    if (emit) {
      this.emit();
    }
  }

  scan(): void {
    this.client.startScan().catch(() => undefined);
  }

  connect(d: DiscoveredDevice): void {
    this.client.connect(d).catch(() => undefined);
  }

  /** Leaving the page (blur/unmount): STOP all outputs. */
  leave(): void {
    this.cancelRelease(false);
    this.client.stopForSafety('leave advanced control');
  }

  // ------------------------------------------------------------ internals

  private card(id: CardId): ModuleCard | undefined {
    return buildCards(this.s.info).find(c => c.id === id);
  }

  private wingCtx(): WingCtx | undefined {
    const c = this.card('wing') as IntensityCard | undefined;
    if (!c) {
      return undefined;
    }
    return {
      link: this.wing.link,
      mode: this.wing.mode,
      rhythm: this.wing.rhythm,
      values: { ...this.wing.values },
      freq: this.wing.freq ?? this.s.tlm?.lraFreqHz ?? c.freq.def,
      groups: c.groups.map(g => g.id),
      freqRange: { min: c.freq.min, max: c.freq.max },
    };
  }

  private dispatch(card: CardId, a: ControlAction): void {
    const ctx = { wing: this.wingCtx(), pulse: this.card('vcm') as RhythmCard | undefined };
    this.run(card, mapAction(a, ctx));
  }

  private run(card: CardId, calls: ReturnType<typeof mapAction>): void {
    if (deriveScreenState(this.s).controlsEnabled) {
      runCalls(this.client, calls);
      this.lastInput = { card, at: this.now() };
    }
    this.emit();
  }

  private onState(s: Icd001State): void {
    const prev = this.s;
    this.s = s;
    this.absorb(s);
    const t = this.now();
    // cooled down: over-temp latch released while still connected
    if (this.prevOverTemp && !s.overTemp && s.status === 'connected') {
      this.cooledUntil = t + COOLED_DOWN_MS;
      this.schedule(COOLED_DOWN_MS);
    }
    this.prevOverTemp = s.overTemp;
    // E-stop released with the START key on the device (§8.3)
    const ch = s.estopChange;
    if (ch && ch.at !== this.seenEstopChangeAt) {
      this.seenEstopChangeAt = ch.at;
      if (!ch.on && ch.source === 'device') {
        this.releasedUntil = t + RELEASED_NOTICE_MS;
        this.schedule(RELEASED_NOTICE_MS);
      } else if (ch.on) {
        this.releasedUntil = 0;
      }
    }
    // non-safety ERR after an input -> revert to device values + toast
    if (s.lastErr && s.lastErr.at !== this.seenErrAt) {
      this.seenErrAt = s.lastErr.at;
      const safety = s.lastSafetyErr?.at === s.lastErr.at;
      if (!safety && this.lastInput && t - this.lastInput.at < ERR_ATTRIBUTION_MS) {
        this.inputAt = { A: -1e12, B: -1e12, vcm: -1e12, freq: -1e12 };
        this.wing.freq = null;
        this.toast = {
          text: `Couldn't change ${CARD_NAME[this.lastInput.card]}. Showing the device's current setting.`,
          until: t + TOAST_MS,
        };
        this.schedule(TOAST_MS);
      }
    }
    if (s.status === 'connected' && prev.status !== 'connected') {
      this.stopQueued = false;
    }
    if (!s.estop) {
      this.cancelRelease(false);
    }
    this.emit();
  }

  /** Pull device values into local state unless the user touched the control recently. */
  private absorb(s: Icd001State): void {
    if (s.info) {
      this.lastInfo = s.info;
    }
    if (s.device) {
      this.lastName = s.device.name;
    }
    const tlm = s.tlm;
    if (!tlm || s.status !== 'connected') {
      return;
    }
    const t = this.now();
    (['A', 'B'] as const).forEach((g, i) => {
      if (t - this.inputAt[g] > OPTIMISTIC_MS) {
        this.wing.values[g] = tlm.lra[i];
        if (tlm.lra[i] > 0) {
          this.wing.restore[g] = tlm.lra[i];
        }
      }
    });
    if (t - this.inputAt.vcm > OPTIMISTIC_MS) {
      this.pulse.hz = tlm.vcm.on ? tlm.vcm.hz : 0;
      if (tlm.vcm.on && tlm.vcm.hz) {
        this.pulse.restore = tlm.vcm.hz;
      }
    }
    if (t - this.inputAt.freq > OPTIMISTIC_MS && tlm.lraFreqHz) {
      this.wing.freq = tlm.lraFreqHz;
    }
    if (tlm.lp.some(p => p[0] > 0) && t - this.inputAt.A > OPTIMISTIC_MS) {
      this.wing.mode = 'rhythm';
    }
  }

  private schedule(ms: number): void {
    if (this.msgTimer) {
      clearTimeout(this.msgTimer);
    }
    this.msgTimer = setTimeout(() => this.emit(), ms + 10);
  }

  private emit(): void {
    this.recompute();
    this.listeners.forEach(l => l());
  }

  private buildViews(info: DeviceInfo | null, live: boolean, screen: ScreenState): CardView[] {
    const s = this.s;
    const tlm = live ? s.tlm : null;
    return buildCards(info).map((card): CardView => {
      const expanded = live && this.expanded === card.id;
      if (card.kind === 'intensity') {
        const enabled = live && screen.controlsEnabled;
        const values = { ...this.wing.values };
        const sum = wingSummary(tlm, card.groups);
        return {
          kind: 'intensity',
          card,
          expanded,
          enabled,
          on: live && (values.A > 0 || values.B > 0),
          values,
          link: this.wing.link,
          mode: this.wing.mode,
          rhythm: this.wing.rhythm,
          rhythmAvailable: !!card.lpulse,
          freq: this.wing.freq ?? card.freq.def,
          summary: !live
            ? '—'
            : !enabled && screen.kind !== 'normal'
            ? 'Paused'
            : `${sum.parts.join(' · ')} · ${sum.mode}`,
        };
      }
      if (card.kind === 'rhythm') {
        const enabled = live && screen.controlsEnabled;
        const hz = this.pulse.hz ?? 0;
        const presets = rhythmPresets(card.range);
        const shown = hz > 0 ? hz : this.pulse.restore || card.range.def;
        const beat = beatLabel(shown, presets);
        return {
          kind: 'rhythm',
          card,
          expanded,
          enabled,
          on: live && hz > 0,
          hz: shown,
          presets,
          beat,
          summary: !live
            ? '—'
            : !enabled && screen.kind !== 'normal'
            ? 'Paused'
            : hz > 0
            ? `${hz} Hz · ${beat}`
            : 'Off',
        };
      }
      const reading = sensorReading(tlm, card);
      const sum = sensorSummary(reading);
      return {
        kind: 'sensor',
        card,
        expanded,
        enabled: true,
        reading,
        summary: live ? `${sum.strong}${sum.rest}` : '—',
        actuator: card.hasActuator ? 'available' : 'needs-hardware',
      };
    });
  }

  private recompute(): void {
    const s = this.s;
    const t = this.now();
    const screen = deriveScreenState(s);
    const live = screen.kind !== 'disconnected';
    let banner = bannerFor(screen, s.tlm, s.estopSource, s.info?.safety ?? null);
    if (!banner && live && t < this.releasedUntil) {
      banner = RELEASED_ON_DEVICE_BANNER;
    }
    if (!banner && live && t < this.cooledUntil) {
      banner = COOLED_DOWN_BANNER;
    }
    const tlm = live ? s.tlm : null;
    this.view = {
      screen,
      banner,
      device: {
        connected: live,
        name: live ? s.device?.name ?? null : null,
        lastName: this.lastName,
        tempText: tempText(tlm?.ntcC ?? null),
        tempWarn: live && s.overTemp,
        vbat: tlm?.vbat ?? null,
        batteryPct: displayBatteryPct(tlm?.vbat ?? null),
        batteryWarn: live && s.lowBattery,
      },
      cards: live ? this.buildViews(s.info, true, screen) : [],
      lastSeen: live ? [] : this.buildViews(this.lastInfo, false, screen),
      scan: { scanning: s.status === 'scanning', connecting: screen.connecting, devices: s.devices },
      estop: {
        on: live && s.estop,
        source: s.estopSource,
        lastChange: s.estopChange,
        holdProgress: this.holdStart === null ? 0 : Math.min(1, (t - this.holdStart) / RELEASE_HOLD_MS),
      },
      expanded: live ? this.expanded : null,
      focusedGroup: live && this.expanded === 'wing' ? this.focusedGroup : null,
      running: {
        upper: !!tlm && tlm.lra[0] > 0,
        lower: !!tlm && tlm.lra[1] > 0,
        head: !!tlm && tlm.vcm.on,
      },
      thresholds: (live ? s.info : this.lastInfo)?.safety ?? null,
      toast: this.toast && t < this.toast.until ? this.toast.text : null,
      stopQueued: this.stopQueued,
    };
  }
}
