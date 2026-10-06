/**
 * Presentation-agnostic view-model for the 高级控制 page.
 *
 * Owns the UI-local state that is not on the device (expanded card, wing
 * link, last non-zero values to restore, remembered Pulse speed, optimistic
 * slider values, E-stop hold progress, transient messages) and turns
 * user intents into client calls via `mapAction` (throttled by the client's
 * CommandScheduler: ~10 Hz per key, latest value wins, ≤20 cmd/s).
 *
 * Visual design v2 renders `AdvancedControlView` and calls the intent
 * methods; nothing here knows about colours, layout or components.
 */
import { effectiveMode } from '../../services/icd001/client';
import { supportsAuto, wingSetpoints } from '../../services/icd001/protocol';

import {
  AUTO_HINT_TOAST,
  AutoSensors,
  BannerModel,
  COOLED_DOWN_BANNER,
  ModeNoticeReason,
  PZERO_DONE_TOAST,
  PZERO_MANUAL_TOAST,
  PZERO_PENDING_TOAST,
  COOLED_DOWN_MS,
  HOTSPOT_ZONES,
  HotspotZone,
  RELEASED_NOTICE_MS,
  RELEASED_ON_DEVICE_BANNER,
  ControlAction,
  ControlClient,
  IntensityCard,
  ModuleCard,
  RhythmCard,
  ScreenState,
  SensorCard,
  SensorReading,
  WingCtx,
  autoSensors,
  bannerFor,
  beatLabel,
  buildCards,
  deriveScreenState,
  displayBatteryPct,
  mapAction,
  modeNoticeBanner,
  modeNoticeFor,
  rhythmPresets,
  runCalls,
  sensorBanner,
  sensorReading,
  sensorSummary,
  wingFreqCorrection,
  tempText,
  wingSummary,
} from './model';
import { PulseSpeedStore, memoryPulseSpeedStore } from './pulseMemory';

import type { Icd001State } from '../../services/icd001/client';
import type { DeviceInfo, DeviceMode, LraGroupId, SafetyThresholds } from '../../services/icd001/protocol';
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
  retry(): Promise<boolean>;
  requestStopOnConnect(): void;
  requestEstopOnConnect(): void;
  downgradeQueuedEstop(): void;
  stopForSafety(reason: string): void;
  /** ICD001-1: MODE AUTO / MODE MANUAL (§11.4). */
  setMode(m: DeviceMode): boolean;
  /** ICD001-1: PZERO (auto only, §11.4.14). */
  pzero(): boolean;
  /** Leave page / background: STOP, nothing (auto) or MODE AUTO hand-back (§11.6.3). */
  releaseControl(reason: string): void;
}

/** Value shown on the collapsed row (design v2 §6.3); hidden while expanded. */
export type RowValue =
  | { kind: 'off'; text: 'Off' | 'No data' }
  | { kind: 'ab'; A: number; B: number }
  | { kind: 'hz'; hz: number }
  | { kind: 'bpm'; bpm: number }
  | { kind: 'text'; text: string };

export interface IntensityView {
  kind: 'intensity';
  row: RowValue;
  card: IntensityCard;
  expanded: boolean;
  enabled: boolean;
  /** Switch position: any group running. */
  on: boolean;
  values: Record<LraGroupId, number>;
  link: boolean;
  summary: string;
  /** Auto running: sliders show the device's actual output, no input (§11.3.8). */
  readOnly: boolean;
}

export interface RhythmView {
  kind: 'rhythm';
  row: RowValue;
  card: RhythmCard;
  expanded: boolean;
  enabled: boolean;
  on: boolean;
  hz: number;
  presets: { soft: number; medium: number; strong: number };
  beat: 'Soft' | 'Medium' | 'Strong';
  summary: string;
  /** Slider range: card.range in manual, INFO ch.auto.vhz (5–10 Hz) in auto (§11.4.8). */
  range: { min: number; max: number };
  readOnly: boolean;
}

export interface SensorView {
  kind: 'sensor';
  row: RowValue;
  card: SensorCard;
  expanded: boolean;
  /** Sensor cards never grey out (read-only). */
  enabled: true;
  reading: SensorReading;
  summary: string;
  /** Egg actuator is not on the hardware yet: 待硬件 / "Needs hardware". */
  actuator: 'needs-hardware' | 'available';
  /** Auto running: status of the sensors auto follows (TLM src, §11.4.4); null otherwise. */
  sensors: AutoSensors | null;
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
  /**
   * Product stage: dim = disconnected / E-stop (grey product); compact = a row is
   * expanded or outputs are paused; tint = per-part accent overlay opacity 0..1
   * (upper = A, lower = B at intensity/100 × STAGE_TINT; head / egg while their row is open).
   */
  stage: {
    dim: boolean;
    compact: boolean;
    tint: { upper: number; lower: number; head: number; egg: number };
  };
  /** Transient two-line notice (title + line), e.g. after a rejected command. */
  toast: { title: string; line: string } | null;
  /** Stop all pressed while offline; ESTOP 1 goes out first on the next connect. */
  stopQueued: boolean;
  /**
   * Auto | Manual control (ICD001-1 only, §11.4.16). `current` follows the
   * device (an in-flight switch shows as its target, `switching`). Auto can't
   * be chosen while latched (§11.4.10).
   */
  mode: {
    supported: boolean;
    current: DeviceMode | null;
    switching: boolean;
    autoAllowed: boolean;
    /** Re-zero pressure shown (auto only, §11.4.14); busy between OK and EVT PZERO. */
    pzero: 'available' | 'busy' | null;
    /**
     * Auto running: sensors Auto follows (TLM src, §11.4.4); null otherwise.
     * Not tied to the Bullet card: fw 1.1.0 has no Bullet sensor (egg ppg -1).
     */
    sensors: AutoSensors | null;
  };
}

type Listener = () => void;

const CARD_NAME: Record<CardId, string> = { wing: 'Wings', vcm: 'Pulse', egg: 'Bullet' };

/**
 * Tinted-PNG overlay opacities, tuned against design v2 (CSS blend) by mean
 * colour per part (call-qa/adv-control-v2/boards/tint-closeup.png).
 * upper / lower are scaled by the group level (0..100).
 */
export const STAGE_TINT = { upper: 0.6, lower: 0.43, head: 0.68, egg: 0.34 } as const;

export class AdvancedControlController {
  private listeners = new Set<Listener>();
  private unsub: (() => void) | null = null;
  private view!: AdvancedControlView;
  private s: Icd001State;
  private lastInfo: DeviceInfo | null = null;
  /** Shown (disabled) before any device was seen; null = no cards (Advanced control). */
  private placeholderInfo: DeviceInfo | null = null;
  private lastName: string | null = null;
  private lastDevice: DiscoveredDevice | null = null;

  private expanded: CardId | null = null;
  private focusedGroup: LraGroupId | null = null;
  private seenEstopChangeAt: number | null = null;
  private releasedUntil = 0;
  /**
   * Wings are always steady on this page (audit F1, PROTOCOL §10.8): sliders
   * send `LRA <grp> <pct>` only. No rhythm mode, and telemetry `lp` never
   * switches the page to LPULSE.
   */
  private wing = {
    link: false,
    values: { A: 0, B: 0 } as Record<LraGroupId, number>,
    restore: { A: 50, B: 50 } as Record<LraGroupId, number>,
  };
  /** FREQ 170 correction done (or not needed) for the current connection. */
  private freqChecked = false;
  private pulse = { hz: null as number | null, restore: 0 };
  /** Device the remembered Pulse speed belongs to (name), and whether it was set this connection. */
  private pulseKey: string | null = null;
  private pulseTouched = false;
  /** leave() already sent STOP for this visit (blur + unmount = one STOP, audit F10). */
  private left = false;
  private inputAt: Record<'A' | 'B' | 'vcm', number> = {
    A: -1e12,
    B: -1e12,
    vcm: -1e12,
  };
  private lastInput: { card: CardId; at: number } | null = null;
  private seenErrAt: number | null = null;
  private prevOverTemp = false;
  private cooledUntil = 0;
  private toast: { title: string; line: string; until: number } | null = null;
  private stopQueued = false;
  /** Mode changed without the user choosing it; cleared by a mode pick or a control input. */
  private modeNotice: ModeNoticeReason | null = null;
  private seenModeChangeId: number | null = null;
  private seenPzeroAt: number | null = null;
  /** E-stop / over-temp / low battery was on when the link dropped (§11.6.2 copy). */
  private latchedAtDrop = false;
  private holdStart: number | null = null;
  private holdTimer: ReturnType<typeof setInterval> | null = null;
  private msgTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly client: ClientLike,
    private readonly now: () => number = Date.now,
    private readonly pulseStore: PulseSpeedStore = memoryPulseSpeedStore,
  ) {
    this.s = client.getState();
    this.seenErrAt = this.s.lastErr?.at ?? null;
    this.seenEstopChangeAt = this.s.estopChange?.at ?? null;
    this.seenModeChangeId = this.s.modeChange?.id ?? null;
    this.seenPzeroAt = this.s.pzero?.at ?? null;
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

  /** Manual page: show the module cards (disabled) before the first connect. */
  setPlaceholderInfo(info: DeviceInfo | null): void {
    if (this.placeholderInfo !== info) {
      this.placeholderInfo = info;
      this.emit();
    }
  }

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

  // ------------------------------------------------------------ auto / manual

  /** Auto | Manual control (§11.4): Manual = explicit takeover, Auto = hand back. */
  setMode(m: DeviceMode): void {
    this.modeNotice = null;
    this.toast = null;
    if (m === 'manual') {
      // takeover starts from 0 (the switch zeroes, §11.3.2): no stale optimistic values
      this.wing.values = { A: 0, B: 0 };
      this.pulse.hz = 0;
    }
    this.client.setMode(m);
    this.emit();
  }

  /** A read-only control was touched while Auto runs: hint, never a silent takeover. */
  autoHint(): void {
    this.showToast(AUTO_HINT_TOAST);
  }

  /** Re-zero pressure (auto only, §11.4.14). */
  pzero(): void {
    if (this.client.pzero()) {
      this.showToast(PZERO_PENDING_TOAST);
    }
  }

  /** Auto is (or is about to be) running on an ICD001-1 device: controls are read-only. */
  private get inAuto(): boolean {
    return supportsAuto(this.s.info) && effectiveMode(this.s) === 'auto';
  }

  /** Guard for every manual input: in auto, hint instead of sending (§11.4.9). */
  private blockedByAuto(): boolean {
    if (this.inAuto) {
      this.autoHint();
      return true;
    }
    this.modeNotice = null;
    return false;
  }

  private showToast(t: { title: string; line: string }): void {
    const now = this.now();
    this.toast = { title: t.title, line: t.line, until: now + TOAST_MS };
    this.schedule(TOAST_MS);
    this.emit();
  }

  setWingValue(group: LraGroupId, value: number): void {
    if (this.blockedByAuto()) {
      return;
    }
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
    if (this.blockedByAuto()) {
      return;
    }
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

  setPulseHz(hz: number, preset = false): void {
    if (this.blockedByAuto()) {
      return;
    }
    const card = this.card('vcm') as RhythmCard | undefined;
    if (!card) {
      return;
    }
    const v = Math.round(Math.max(card.range.min, Math.min(card.range.max, hz)));
    this.rememberPulse(v);
    if (!preset && !((this.pulse.hz ?? 0) > 0)) {
      // Output is off (design v2: separate Output switch): only remember the
      // rhythm; the switch turns it on at this value.
      this.emit();
      return;
    }
    this.pulse.hz = v;
    this.inputAt.vcm = this.now();
    this.dispatch('vcm', preset ? { t: 'pulsePreset', hz: v } : { t: 'pulseSlider', hz: v });
  }

  setPulseOn(on: boolean): void {
    if (this.blockedByAuto()) {
      return;
    }
    const card = this.card('vcm') as RhythmCard | undefined;
    if (!card) {
      return;
    }
    const calls = mapAction({ t: 'pulseSwitch', on, lastHz: this.pulse.restore }, { pulse: card });
    const c = calls[0];
    if (c && c.fn === 'setVcmHz') {
      this.pulse.hz = c.hz;
      if (c.hz > 0) {
        this.rememberPulse(c.hz);
      }
    }
    this.inputAt.vcm = this.now();
    this.run('vcm', calls);
  }

  /**
   * Stop all: ESTOP 1 when connected. Offline (design v4 §5, PROTOCOL §5/§9):
   * the firmware already stopped on BLE drop; record the e-stop and send
   * ESTOP 1 as the first command on the next connect, so the page comes back
   * Stopped + Unlock. Shown values drop to 0 right away (Speed is kept).
   */
  stopAll(): void {
    this.wing.values = { A: 0, B: 0 };
    this.pulse.hz = 0;
    // optimistic 0 until telemetry reflects the stop (OPTIMISTIC_MS)
    const t = this.now();
    this.inputAt = { A: t, B: t, vcm: t };
    if (this.s.status === 'connected') {
      runCalls(this.client, mapAction({ t: 'stopAll' }, {}));
    } else {
      this.client.requestEstopOnConnect();
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

  /** Design v2: one tap on Release sends ESTOP 0 (no hold). */
  release(): void {
    if (this.s.estop && this.s.status === 'connected') {
      this.cancelRelease(false);
      runCalls(this.client, mapAction({ t: 'release' }, {}));
    }
    this.emit();
  }

  /** Reconnect to the last device (Connection lost notice); scans if there is none. */
  reconnect(): void {
    if (this.lastDevice) {
      this.client.connect(this.lastDevice).catch(() => undefined);
    } else {
      this.scan();
    }
  }

  scan(): void {
    this.client.startScan().catch(() => undefined);
  }

  /** Retry a failed connect (notice action): same device; scans if there is none. */
  retry(): void {
    if (this.client.getState().device) {
      this.client.retry().catch(() => undefined);
    } else {
      this.scan();
    }
  }

  connect(d: DiscoveredDevice): void {
    this.client.connect(d).catch(() => undefined);
  }

  /** Page focused (again): re-arm leave() so the next blur/unmount sends STOP. */
  enter(): void {
    this.left = false;
  }

  /**
   * Leaving the page (blur/unmount), once per visit (blur followed by unmount
   * acts once; audit F10). Older firmware: STOP. ICD001-1 (§11.6.3): auto keeps
   * running (nothing sent), a manual takeover is handed back with MODE AUTO,
   * latched -> STOP (client.releaseControl). An e-stop queued while offline
   * becomes a plain STOP: without this page there is no Unlock on screen, so
   * the device must not reconnect latched behind another page.
   */
  leave(): void {
    this.pulseStore.flush();
    if (this.left) {
      return;
    }
    this.left = true;
    this.cancelRelease(false);
    if (this.stopQueued) {
      this.client.downgradeQueuedEstop();
      this.stopQueued = false;
    }
    this.client.releaseControl('leave advanced control');
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
      mode: 'steady', // audit F1: never LPULSE from this page
      rhythm: 'medium',
      values: { ...this.wing.values },
      groups: c.groups.map(g => g.id),
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
    // ICD001-1 mode changes the user did not choose -> notice (§11.4.6, §11.5)
    const mc = s.modeChange;
    if (mc && mc.id !== this.seenModeChangeId) {
      this.seenModeChangeId = mc.id;
      const notice = modeNoticeFor(mc.from, mc.to, mc.reason);
      if (notice) {
        this.modeNotice = notice;
      } else if (mc.reason === 'CMD') {
        this.modeNotice = null;
      }
    }
    if (s.status !== 'connected' && prev.status === 'connected') {
      // ICD001-1 §11.8: only over-temp / low battery keep it manual over a drop (an
      // E-stop is released and the device returns to auto). Used for auto devices only.
      this.latchedAtDrop = prev.overTemp || prev.lowBattery;
      this.modeNotice = null; // the Connection lost notice takes over; reconnect re-reads the mode
    }
    // PZERO done (EVT PZERO, also the PAUSE key)
    if (s.pzero && s.pzero.at !== this.seenPzeroAt) {
      this.seenPzeroAt = s.pzero.at;
      if (s.pzero.state === 'done') {
        this.toast = { ...PZERO_DONE_TOAST, until: t + TOAST_MS };
        this.schedule(TOAST_MS);
      }
    }
    // non-safety ERR after an input -> revert to device values + toast
    if (s.lastErr && s.lastErr.at !== this.seenErrAt) {
      this.seenErrAt = s.lastErr.at;
      const safety = s.lastSafetyErr?.at === s.lastErr.at;
      const ei = s.lastErrInfo?.at === s.lastErr.at ? s.lastErrInfo : null;
      // §11.4.9 race: an input already on the wire when MODE AUTO went out is
      // refused with `ERR MODE AUTO <verb>`: expected, silent. MODE / HB
      // rejections have their own notices (latch) or none (RANGE HB).
      const silent =
        !!ei && (ei.reason === 'MODE AUTO' || ei.verb === 'MODE' || ei.verb === 'AUTO' || ei.verb === 'HB');
      if (ei?.verb === 'PZERO') {
        // ERR MODE MANUAL PZERO -> toast; ERR BUSY PZERO (§11.7.7): the running
        // re-zero finishes with EVT PZERO; a latch reason has its own banner.
        if (ei.reason.startsWith('MODE')) {
          this.toast = { ...PZERO_MANUAL_TOAST, until: t + TOAST_MS };
          this.schedule(TOAST_MS);
        }
      } else if (!safety && !silent && this.lastInput && t - this.lastInput.at < ERR_ATTRIBUTION_MS) {
        this.inputAt = { A: -1e12, B: -1e12, vcm: -1e12 };
        this.toast = {
          title: `Couldn't change ${CARD_NAME[this.lastInput.card]}`,
          line: "Showing the device's setting.",
          until: t + TOAST_MS,
        };
        this.schedule(TOAST_MS);
      }
    }
    if (s.status === 'connected' && prev.status !== 'connected') {
      this.stopQueued = false;
      this.freqChecked = false;
    }
    this.ensureWingFreq(s);
    if (!s.estop) {
      this.cancelRelease(false);
    }
    this.emit();
  }

  /**
   * Wing frequency is fixed at WING_FREQ_HZ (no UI). Once INFO and the first TLM
   * are in, send `FREQ 170` if the device reports anything else; otherwise send
   * nothing. Retried on later updates only while the client refuses (locked).
   */
  private ensureWingFreq(s: Icd001State): void {
    if (this.freqChecked || s.status !== 'connected' || !s.info || !s.tlm) {
      return;
    }
    const fix = wingFreqCorrection(s.info, s.tlm.lraFreqHz);
    if (!fix || fix.fn !== 'setFreq') {
      this.freqChecked = true;
      return;
    }
    this.freqChecked = true; // set first: setFreq can re-enter onState synchronously
    this.freqChecked = this.client.setFreq(fix.hz);
  }

  /** Pull device values into local state unless the user touched the control recently. */
  private absorb(s: Icd001State): void {
    if (s.info) {
      this.lastInfo = s.info;
    }
    if (s.device) {
      this.lastName = s.device.name;
      this.lastDevice = s.device;
      this.loadPulse(s.device.name ?? s.device.id);
    }
    const tlm = s.tlm;
    if (!tlm || s.status !== 'connected') {
      return;
    }
    if (supportsAuto(s.info) && effectiveMode(s) !== 'manual') {
      // Auto: cards render telemetry directly; the manual values / remembered
      // Pulse speed are not overwritten by auto output (5–10 Hz, §11.4.8).
      return;
    }
    const t = this.now();
    // Manual sliders follow the setpoint (`lset`), not the actual output: the
    // current budget can lower `lra` (J12 on) and it ramps (fw 1.1.0).
    const set = wingSetpoints(tlm);
    (['A', 'B'] as const).forEach((g, i) => {
      if (t - this.inputAt[g] > OPTIMISTIC_MS) {
        this.wing.values[g] = set[i];
        if (set[i] > 0) {
          this.wing.restore[g] = set[i];
        }
      }
    });
    if (t - this.inputAt.vcm > OPTIMISTIC_MS) {
      this.pulse.hz = tlm.vcm.on ? tlm.vcm.hz : 0;
      if (tlm.vcm.on && tlm.vcm.hz) {
        this.rememberPulse(tlm.vcm.hz);
      }
    }
    // Telemetry `lp` is deliberately ignored here (audit F1): wings stay steady.
  }

  /** Last Pulse speed the user chose (or the device ran): kept by the app, §10.7. */
  private rememberPulse(hz: number): void {
    this.pulse.restore = hz;
    this.pulseTouched = true;
    if (this.pulseKey) {
      this.pulseStore.set(this.pulseKey, hz);
    }
  }

  /** New device: restore its remembered Pulse speed (cache now, storage async). */
  private loadPulse(name: string): void {
    if (this.pulseKey === name) {
      return;
    }
    this.pulseKey = name;
    this.pulseTouched = false;
    const cached = this.pulseStore.get(name);
    if (cached !== null) {
      this.pulse.restore = cached;
      return;
    }
    this.pulseStore
      .load(name)
      .then(v => {
        if (v !== null && this.pulseKey === name && !this.pulseTouched) {
          this.pulse.restore = v;
          this.emit();
        }
      })
      .catch(() => undefined);
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
    const auto = live && this.inAuto;
    const autoRange = info?.auto?.vhz ?? null;
    return buildCards(info).map((card): CardView => {
      const expanded = live && this.expanded === card.id;
      if (card.kind === 'intensity' && auto) {
        const values = { A: tlm ? tlm.lra[0] : 0, B: tlm ? tlm.lra[1] : 0 };
        return {
          kind: 'intensity',
          row: { kind: 'ab', A: values.A, B: values.B },
          card,
          expanded,
          enabled: false,
          on: values.A > 0 || values.B > 0,
          values,
          link: this.wing.link,
          summary: 'Auto',
          readOnly: true,
        };
      }
      if (card.kind === 'rhythm' && auto) {
        const hz = tlm && tlm.vcm.on ? tlm.vcm.hz ?? 0 : 0;
        const range = autoRange ?? card.range;
        const presets = rhythmPresets({ ...range, def: range.min });
        return {
          kind: 'rhythm',
          row: hz > 0 ? { kind: 'hz', hz } : { kind: 'off', text: 'Off' },
          card,
          expanded,
          enabled: false,
          on: hz > 0,
          hz: hz > 0 ? hz : range.min,
          presets,
          beat: beatLabel(hz, presets),
          summary: 'Auto',
          range: { min: range.min, max: range.max },
          readOnly: true,
        };
      }
      if (card.kind === 'intensity') {
        const enabled = live && screen.controlsEnabled;
        // Disconnected / e-stopped: firmware has stopped everything (§5, §7.5).
        const values = live && screen.kind !== 'estop' ? { ...this.wing.values } : { A: 0, B: 0 };
        const sum = wingSummary(tlm, card.groups);
        return {
          kind: 'intensity',
          row: enabled ? { kind: 'ab', A: values.A, B: values.B } : { kind: 'off', text: 'Off' },
          card,
          expanded,
          enabled,
          on: live && (values.A > 0 || values.B > 0),
          values,
          link: this.wing.link,
          summary: !live
            ? '—'
            : !enabled && screen.kind !== 'normal'
            ? 'Paused'
            : `${sum.parts.join(' · ')} · ${sum.mode}`,
          readOnly: false,
        };
      }
      if (card.kind === 'rhythm') {
        const enabled = live && screen.controlsEnabled;
        const hz = live && screen.kind !== 'estop' ? this.pulse.hz ?? 0 : 0;
        const presets = rhythmPresets(card.range);
        const remembered = this.pulse.restore
          ? Math.max(card.range.min, Math.min(card.range.max, this.pulse.restore))
          : card.range.def;
        const shown = hz > 0 ? hz : remembered;
        const beat = beatLabel(shown, presets);
        return {
          kind: 'rhythm',
          row: enabled && hz > 0 ? { kind: 'hz', hz } : { kind: 'off', text: 'Off' },
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
          range: { min: card.range.min, max: card.range.max },
          readOnly: false,
        };
      }
      const reading = sensorReading(tlm, card);
      const sum = sensorSummary(reading);
      let row: RowValue;
      if (!live || !reading.available) {
        row = { kind: 'off', text: 'No data' };
      } else if (!reading.contact) {
        row = { kind: 'text', text: 'Not on skin' };
      } else {
        row = reading.hr ? { kind: 'bpm', bpm: reading.hr } : { kind: 'text', text: 'Measuring' };
      }
      return {
        kind: 'sensor',
        row,
        card,
        expanded,
        enabled: true,
        reading,
        summary: live ? `${sum.strong}${sum.rest}` : '—',
        actuator: card.hasActuator ? 'available' : 'needs-hardware',
        sensors: auto ? autoSensors(tlm, info) : null,
      };
    });
  }

  private stageView(screen: ScreenState, live: boolean): AdvancedControlView['stage'] {
    const active = live && screen.kind === 'normal';
    const tint = { upper: 0, lower: 0, head: 0, egg: 0 };
    if (active) {
      const tlm = this.s.tlm;
      // Auto: actual output; manual: the setpoint the sliders show
      const w = tlm ? (this.inAuto ? tlm.lra : wingSetpoints(tlm)) : [0, 0];
      const a = w[0];
      const b = w[1];
      // optimistic values while dragging, telemetry otherwise
      const t = this.now();
      const va = t - this.inputAt.A <= OPTIMISTIC_MS ? this.wing.values.A : a;
      const vb = t - this.inputAt.B <= OPTIMISTIC_MS ? this.wing.values.B : b;
      tint.upper = (Math.max(0, Math.min(100, va)) / 100) * STAGE_TINT.upper;
      tint.lower = (Math.max(0, Math.min(100, vb)) / 100) * STAGE_TINT.lower;
      tint.head = this.expanded === 'vcm' ? STAGE_TINT.head : 0;
      tint.egg = this.expanded === 'egg' ? STAGE_TINT.egg : 0;
    }
    return {
      dim: screen.kind === 'disconnected' || screen.kind === 'estop',
      compact: (live && this.expanded !== null) || screen.kind !== 'normal',
      tint,
    };
  }

  private recompute(): void {
    const s = this.s;
    const t = this.now();
    const screen = deriveScreenState(s);
    const live = screen.kind !== 'disconnected';
    const autoDevice = supportsAuto(live ? s.info : this.lastInfo);
    const n = this.modeNotice;
    const autoOff =
      (screen.kind === 'estop' && (n === 'ESTOP' || n === 'KEY')) ||
      (screen.kind === 'overtemp' && n === 'OVERTEMP') ||
      (screen.kind === 'lowbat' && n === 'LOWBAT');
    let banner = bannerFor(screen, s.tlm, s.estopSource, s.info?.safety ?? null, {
      hadDevice: this.lastName !== null,
      stopQueued: this.stopQueued,
      autoDevice,
      latchedAtDrop: this.latchedAtDrop,
      autoOff,
      failure: s.status === 'error' || s.status === 'disconnected' ? s.connectFailure : null,
    });
    if (!banner && live && n) {
      banner = modeNoticeBanner(n);
    }
    const inAuto = live && this.inAuto;
    if (!banner && inAuto && effectiveMode(s) === s.mode) {
      banner = sensorBanner(autoSensors(s.tlm, s.info));
    }
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
      lastSeen: live ? [] : this.buildViews(this.lastInfo ?? this.placeholderInfo, false, screen),
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
      stage: this.stageView(screen, live),
      toast: this.toast && t < this.toast.until ? { title: this.toast.title, line: this.toast.line } : null,
      stopQueued: this.stopQueued,
      mode: {
        supported: live && autoDevice,
        current: live && autoDevice ? effectiveMode(s) : null,
        switching: live && s.modePending !== null,
        autoAllowed: live && !s.estop && !s.overTemp && !s.lowBattery,
        pzero: inAuto && s.mode === 'auto' ? (s.pzero?.state === 'pending' ? 'busy' : 'available') : null,
        sensors: live && inAuto ? autoSensors(s.tlm, s.info) : null,
      },
    };
  }
}
