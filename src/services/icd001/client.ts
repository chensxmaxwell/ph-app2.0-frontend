/**
 * Icd001Client: framework-agnostic device session for ICD-001 / H1.1.
 * scan -> connect -> MTU -> INFO -> TLM stream, typed state, throttled command
 * API, safety interlocks, auto-reconnect. React binding lives in useIcd001.ts.
 */
import {
  CONNECT_TIMEOUT_MS,
  ConnectFailure,
  ConnectStep,
  ConnectStepError,
  STEP_TIMEOUT_MS,
  connectFailureFor,
  infoCmdTimeoutMs,
  toStepError,
  withTimeout,
} from './connectSteps';
import {
  DeviceInfo,
  DeviceMode,
  ErrInfo,
  ICD001_DEFAULT_TLM_HZ,
  LineAssembler,
  LraTarget,
  OkReply,
  Telemetry,
  SafetyErr,
  encodeCommand,
  formatEstop,
  formatFreq,
  formatHb,
  formatLpulse,
  formatLra,
  formatMode,
  formatPing,
  formatPzero,
  formatRate,
  formatStop,
  formatVcmHz,
  parseErr,
  parseInfo,
  parseLine,
  parseModeEvt,
  safetyErrOf,
  supportsAuto,
} from './protocol';
import { CommandScheduler } from './throttle';
import { decodeUtf8 } from './utf8';

import type { DiscoveredDevice, Icd001Transport } from './transport';

export type ConnStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type LockReason = 'disconnected' | 'noinfo' | 'estop' | 'overtemp' | 'lowbat' | 'stale';

/**
 * Leaving the control page / app background while the user holds a manual
 * takeover on ICD001-1 (§11.6.3): 'handback' = `MODE AUTO` (firmware zeroes,
 * then auto, reason CMD); 'stop' = `STOP` (stays manual at 0). One switch.
 */
export const MANUAL_LEAVE_ACTION: 'handback' | 'stop' = 'handback';
/** HB seconds the app asks for on ICD001-1 (§11.4.12; protects the manual takeover). */
export const APP_HB_S = 10;
/** A PING goes out with a TLM frame when nothing was written for this long (any command feeds HB). */
export const PING_IDLE_MS = 3000;
/** No OK / ERR to a MODE change within this window -> re-query with `MODE`. */
export const MODE_REPLY_TIMEOUT_MS = 2000;
/** TLM rate while the app is in the background (ICD001-1). */
export const BACKGROUND_TLM_HZ = 2;

export interface ModeChange {
  from: DeviceMode | null;
  to: DeviceMode;
  /** §11.4.6 reason (CMD, STOP, ESTOP, KEY, OVERTEMP, LOWBAT, HOST_TIMEOUT, …); null = seen in TLM only. */
  reason: string | null;
  /** 'evt' = EVT MODE; 'query' = OK MODE <x> <lastReason> after a reconnect; 'tlm' = no EVT seen. */
  via: 'evt' | 'query' | 'tlm';
  at: number;
  /** Increments per change (dedupe key; two changes can share a millisecond). */
  id: number;
}

export interface Icd001State {
  transport: 'ble' | 'mock';
  status: ConnStatus;
  devices: DiscoveredDevice[];
  device: DiscoveredDevice | null;
  mtu: number | null;
  info: DeviceInfo | null;
  tlm: Telemetry | null;
  tlmAt: number | null;
  estop: boolean;
  /**
   * Who engaged the E-stop: this app (`OK ESTOP 1`), the device START key
   * (`EVT ESTOP 1` received on this connection), or 'unknown' (seen only in
   * TLM, e.g. a latch that survived a disconnect, §10.1, not set by this app).
   */
  estopSource: EstopSource | null;
  /**
   * Last E-stop transition, incl. who caused it. `{on:false, source:'device'}` =
   * released with the START key on the device (§8.3), no ESTOP 0 from the app.
   */
  estopChange: { on: boolean; source: EstopSource; at: number } | null;
  overTemp: boolean;
  lowBattery: boolean;
  /** Actuator controls must be disabled when true (see lockReasons). */
  locked: boolean;
  lockReasons: LockReason[];
  lastErr: { text: string; at: number } | null;
  /** Last firmware safety rejection (ERR ESTOP / OVERTEMP / LOWBAT). */
  lastSafetyErr: { reason: SafetyErr; at: number } | null;
  lastReply: string | null;
  /** Last parsed success reply (§10.5), e.g. `{cmd:'LRA', a:40, b:0}` for `OK LRA 40 0`. */
  lastAck: (OkReply & { at: number }) | null;
  reconnectAttempt: number;
  error: string | null;
  /** Why the last connect / reconnect failed (two-line notice + Retry); null once connected. */
  connectFailure: ConnectFailure | null;
  /** Step the running connect is in (null when not connecting). */
  connectStep: ConnectStep | null;
  /** Connect step log (kept apart from `log`, which TLM scrolls), for the debug screen. */
  connectLog: string[];
  /** Last ~40 raw lines in/out, for the debug screen. */
  log: string[];
  // ---- ICD001-1 auto / manual (§11.4–§11.6). All null / false on older firmware.
  /** INFO says proto ICD001-1 with ch.mode "auto" (§11.4.16). */
  autoSupported: boolean;
  /** Device mode (TLM `mode` is authoritative, plus OK MODE / EVT MODE). */
  mode: DeviceMode | null;
  /** MODE AUTO / MODE MANUAL sent, reply not in yet. UI treats it as the mode. */
  modePending: DeviceMode | null;
  /** Last reason for the current mode (EVT MODE / MODE query lastReason). */
  modeReason: string | null;
  modeChange: ModeChange | null;
  /** `OK HB s` seen on this connection (0 = off). */
  hb: number | null;
  /** PZERO: 'pending' after OK PZERO, 'done' at EVT PZERO (also the PAUSE key). */
  pzero: { state: 'pending' | 'done'; at: number } | null;
  /** Parsed words of the last ERR (§11.4.5). */
  lastErrInfo: (ErrInfo & { at: number }) | null;
  /** App in the background (RATE 2, §C of REVIEW-S11-app). */
  background: boolean;
}

/** Mode the UI should show: an in-flight change wins over the last report. */
export function effectiveMode(s: Pick<Icd001State, 'mode' | 'modePending'>): DeviceMode | null {
  return s.modePending ?? s.mode;
}

export type EstopSource = 'app' | 'device' | 'unknown';

export interface Icd001ClientOptions {
  tlmHz?: number;
  reconnectDelaysMs?: number[];
  staleTlmMs?: number;
  scanTimeoutMs?: number;
}

type Listener = (s: Icd001State) => void;

const LOG_MAX = 40;
const CONNECT_LOG_MAX = 30;

const hhmmss = (t: number) => {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

export class Icd001Client {
  private state: Icd001State;
  private listeners = new Set<Listener>();
  /** 4096 B per line: well above the 1100 B INFO command reply (INFO_REPLY_MAX_BYTES). */
  private assembler = new LineAssembler();
  private scheduler: CommandScheduler;
  private unsubs: Array<() => void> = [];
  private userDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Increments per connect attempt / disconnect; a stale attempt stops at its next step. */
  private connectGen = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private infoWaiters: Array<(i: DeviceInfo) => void> = [];
  /**
   * Legacy firmware (no `lb` / `ot` in TLM) has no latches: the app applies the
   * INFO thresholds (legacy INFO lacks them -> OT_FALLBACK / LB_FALLBACK), and
   * sends STOP when a latch trips. Low battery clears only after vbat > clearV
   * for holdS seconds, like v0 firmware (§8.2).
   */
  private legacyLowBat = false;
  private legacyLbAboveSince: number | null = null;
  private legacyOt = false;
  private readonly opts: Required<Icd001ClientOptions>;
  /**
   * What to send first on the next connect (one-shot):
   *  - 'estop': Stop all pressed on the advanced-control page while offline
   *    (design v4 §5). `ESTOP 1` goes out right after INFO, before RATE and
   *    before the link is reported connected, so the page reconnects latched
   *    (Stopped + Unlock) and no actuator command can precede it.
   *  - 'stop':  plain STOP (the page was left while an e-stop was queued; the
   *    firmware already stopped on BLE drop, §5, so this is belt and braces).
   */
  private onConnectAction: 'estop' | 'stop' | null = null;
  /**
   * Device id whose E-stop this app engaged (`OK ESTOP 1`), kept across
   * disconnects: the firmware keeps the latch over a BLE drop (§10.1), so the
   * first `estop:1` frame after reconnect is still shown as the app's stop.
   * Cleared when the latch is seen released (OK/EVT ESTOP 0, TLM estop 0).
   */
  private appEstopDevice: string | null = null;
  /** Last write time (any command feeds the firmware HB, §11.4.12). */
  private lastWriteAt = 0;
  private modeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Effective mode when the link dropped (reconnect notice via MODE lastReason). */
  private modeAtLinkLoss: DeviceMode | null = null;
  /** MODE query sent by establish(); its reply may carry BLE_DISCONNECT. */
  private awaitingModeQuery = false;
  private modeSeq = 0;
  /**
   * Single place E-stop state changes. The message type tells who caused it
   * (PROTOCOL §9, hardware-confirmed; no time windows):
   *  - `OK ESTOP n`  only ever answers the app's own `ESTOP n`   -> 'app'
   *  - `EVT ESTOP n` that changes the latch: START key            -> 'device'
   *                  (ICD001-1 firmware may also echo `EVT ESTOP n` right after
   *                  `OK ESTOP n`, hardware 10/06; no change -> source kept)
   *  - TLM `estop`   carries no origin: an already-engaged stop keeps its source.
   *                  Engaged seen only in TLM (latch kept over a disconnect,
   *                  §10.1, or reply/EVT lost) -> 'app' if this app engaged it on
   *                  this device before the drop, else 'unknown'; never 'device'
   *                  without an `EVT ESTOP` on this connection (audit F2).
   *                  Released seen only in TLM while connected -> 'device'
   *                  (only the START key can do that, §8.3).
   * An extra STOP while latched is harmless (`OK STOP`, latch unchanged).
   */
  private applyEstop(
    on: boolean,
    via: 'ok' | 'evt' | 'tlm',
    patch: Partial<Icd001State> = {},
  ): Partial<Icd001State> {
    const changed = on !== this.state.estop;
    const devId = this.state.device?.id ?? null;
    let source: EstopSource;
    if (via === 'ok') {
      source = 'app';
    } else if (via === 'evt' && !changed && this.state.estopSource === 'app') {
      // hardware 10/06: an EVT ESTOP n may follow our own OK ESTOP n; keep 'app'
      source = 'app';
    } else if (via === 'evt') {
      source = 'device';
    } else if (!changed) {
      source = this.state.estopSource ?? 'unknown';
    } else if (on) {
      source = devId !== null && this.appEstopDevice === devId ? 'app' : 'unknown';
    } else {
      source = 'device';
    }
    if (!on) {
      this.appEstopDevice = null;
    } else if (source === 'app') {
      this.appEstopDevice = devId;
    } else if (changed) {
      this.appEstopDevice = null;
    }
    patch.estop = on;
    patch.estopSource = on ? source : null;
    if (changed) {
      patch.estopChange = { on, source, at: Date.now() };
    }
    return patch;
  }

  constructor(readonly transport: Icd001Transport, opts: Icd001ClientOptions = {}) {
    this.opts = {
      tlmHz: opts.tlmHz ?? ICD001_DEFAULT_TLM_HZ,
      reconnectDelaysMs: opts.reconnectDelaysMs ?? [1000, 2000, 4000, 8000, 8000],
      staleTlmMs: opts.staleTlmMs ?? 3000,
      scanTimeoutMs: opts.scanTimeoutMs ?? 8000,
    };
    this.state = {
      transport: transport.kind,
      status: 'idle',
      devices: [],
      device: null,
      mtu: null,
      info: null,
      tlm: null,
      tlmAt: null,
      estop: false,
      estopSource: null,
      estopChange: null,
      overTemp: false,
      lowBattery: false,
      locked: true,
      lockReasons: ['disconnected'],
      lastErr: null,
      lastSafetyErr: null,
      lastReply: null,
      lastAck: null,
      reconnectAttempt: 0,
      error: null,
      connectFailure: null,
      connectStep: null,
      connectLog: [],
      log: [],
      autoSupported: false,
      mode: null,
      modePending: null,
      modeReason: null,
      modeChange: null,
      hb: null,
      pzero: null,
      lastErrInfo: null,
      background: false,
    };
    this.scheduler = new CommandScheduler((line, urgent) => this.write(line, urgent), {
      onError: (line, e) => this.pushLog(`! write failed: ${line} (${String(e)})`),
    });
    this.unsubs.push(
      transport.onNotify((id, bytes) => {
        if (id === this.state.device?.id) {
          this.onBytes(bytes);
        }
      }),
      transport.onDisconnected(id => {
        if (id === this.state.device?.id) {
          this.onLinkLost();
        }
      }),
    );
  }

  // ------------------------------------------------------------ state

  getState = (): Icd001State => this.state;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(patch: Partial<Icd001State>): void {
    const next = { ...this.state, ...patch };
    const reasons = computeLockReasons(next, this.opts.staleTlmMs);
    next.lockReasons = reasons;
    next.locked = reasons.length > 0;
    const becameLocked = next.locked && !this.state.locked;
    this.state = next;
    if (becameLocked) {
      // Never let queued slider values fire after a safety lock.
      this.scheduler.clear();
    }
    this.listeners.forEach(l => l(next));
  }

  private pushLog(line: string): void {
    const log = this.state.log.concat(line);
    this.set({
      log: log.length > LOG_MAX ? log.slice(log.length - LOG_MAX) : log,
    });
  }

  // ------------------------------------------------------------ scan / connect

  async startScan(): Promise<void> {
    try {
      await this.transport.init();
    } catch (e) {
      this.set({
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
      return;
    }
    this.set({ status: 'scanning', devices: [], error: null });
    try {
      await this.transport.startScan(d => {
        const devices = this.state.devices.filter(x => x.id !== d.id).concat(d);
        devices.sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
        this.set({ devices });
      }, this.opts.scanTimeoutMs);
      setTimeout(() => {
        if (this.state.status === 'scanning') {
          this.stopScan();
        }
      }, this.opts.scanTimeoutMs);
    } catch (e) {
      this.set({ status: 'error', error: `扫描失败：${String(e)}` });
    }
  }

  async stopScan(): Promise<void> {
    await this.transport.stopScan().catch(() => undefined);
    if (this.state.status === 'scanning') {
      this.set({ status: 'idle' });
    }
  }

  async connect(device: DiscoveredDevice): Promise<boolean> {
    await this.stopScan();
    this.userDisconnect = false;
    this.clearReconnect();
    this.set({
      status: 'connecting',
      device,
      error: null,
      connectFailure: null,
      reconnectAttempt: 0,
    });
    return this.establish(device);
  }

  /** Retry after a failed connect / reconnect (notice action): same device, fresh attempt. */
  retry(): Promise<boolean> {
    const dev = this.state.device;
    return dev ? this.connect(dev) : Promise.resolve(false);
  }

  private connectLogLine(line: string): void {
    const log = this.state.connectLog.concat(`${hhmmss(Date.now())} ${line}`);
    this.set({ connectLog: log.length > CONNECT_LOG_MAX ? log.slice(log.length - CONNECT_LOG_MAX) : log });
  }

  /**
   * Link + INFO + setup. Every step is bounded (connectSteps.ts) and the whole
   * connect is capped at CONNECT_TIMEOUT_MS; on any failure the pending
   * connection is cancelled (transport.disconnect) and the state goes to
   * `error` with a ConnectFailure (or the next bounded reconnect attempt).
   * A newer connect / disconnect supersedes this one (generation check).
   */
  private async establish(device: DiscoveredDevice): Promise<boolean> {
    const gen = ++this.connectGen;
    const started = Date.now();
    const deadline = started + CONNECT_TIMEOUT_MS;
    const attempt = this.state.status === 'reconnecting' ? ` (reconnect ${this.state.reconnectAttempt})` : '';
    this.assembler.reset();
    this.scheduler.clear();
    this.connectLogLine(`connect ${device.name ?? device.id}${attempt}`);
    const current = () => gen === this.connectGen && !this.userDisconnect;
    let at: ConnectStep = 'bluetooth';
    const enter = (s: ConnectStep) => {
      if (!current()) {
        return;
      }
      at = s;
      this.set({ connectStep: s });
      this.connectLogLine(`… ${s}`);
    };
    /** Run one step bounded by its own limit and the overall deadline. */
    const step = async <T>(s: ConnectStep, run: () => Promise<T>, limit = STEP_TIMEOUT_MS[s]): Promise<T> => {
      if (!current()) {
        throw new ConnectStepError(s, 'failed', 'superseded');
      }
      enter(s);
      const left = deadline - Date.now();
      if (left <= 0) {
        throw new ConnectStepError(s, 'timeout', `connect took over ${CONNECT_TIMEOUT_MS / 1000} s`);
      }
      try {
        return await withTimeout(run(), Math.min(limit, left), s);
      } catch (e) {
        throw toStepError(e, s);
      }
    };
    try {
      await step('bluetooth', () => this.transport.init());
      // Transport bounds its own native sub-steps; this caps the whole link setup.
      const { mtu } = await step('link', () => this.transport.connect(device.id, enter), CONNECT_TIMEOUT_MS);
      this.set({ mtu });
      let info: DeviceInfo | null = null;
      try {
        info = parseInfo(decodeUtf8(await step('info', () => this.transport.readInfo(device.id))));
      } catch (e) {
        if (e instanceof ConnectStepError && e.message === 'superseded') {
          throw e;
        }
        info = null;
      }
      // INFO command reply is one ≤ 1100 B line (fw 1.1.2 ≈ 874 B): 55 notifications at MTU 23.
      const infoCmdMs = infoCmdTimeoutMs(mtu);
      const infoCmd = async () => {
        const r = await step('info-cmd', () => this.requestInfoViaCommand(infoCmdMs), infoCmdMs);
        if (!r) {
          this.connectLogLine(`info-cmd: no reply in ${infoCmdMs} ms`);
        }
        return r;
      };
      if (!info) {
        info = await infoCmd();
      }
      if (!info) {
        // Connected, ICD-001 service there, but no INFO JSON we can read: old / other firmware.
        throw new ConnectStepError('info', 'unsupported', 'no INFO (characteristic or command)');
      }
      if (supportsAuto(info) && info.auto && !info.auto.detail) {
        // h11-icd-v1 1.1.x: the INFO characteristic (≤ 512 B) leaves out ch.auto
        // (fsr / lraSrc / hbMaxS / vhz); the INFO command returns the full JSON
        // (1.1.0 ≈ 636 B, 1.1.2 ≈ 874 B, buffer 1100 B) as several notify packets
        // (one line). Unknown keys (auto.hrValid, hrValid.fast) are ignored. Fallbacks if it does not come.
        const full = await infoCmd();
        if (full && supportsAuto(full)) {
          info = full;
        }
      }
      if (!current()) {
        throw new ConnectStepError(at, 'failed', 'superseded');
      }
      const auto = supportsAuto(info);
      this.clearModeTimer();
      this.set({
        info,
        tlm: null,
        tlmAt: null,
        estop: false,
        estopSource: null,
        overTemp: false,
        lowBattery: false,
        autoSupported: auto,
        mode: null,
        modePending: null,
        modeReason: null,
        hb: null,
        pzero: null,
      });
      this.legacyLowBat = false;
      this.legacyLbAboveSince = null;
      this.legacyOt = false;
      const first = this.onConnectAction;
      this.onConnectAction = null;
      const setupInfo = info;
      await step('setup', async () => {
        if (first === 'estop') {
          // State/source follow the `OK ESTOP 1` reply (§9), like setEstop().
          await this.write(formatEstop(true), true);
        }
        await this.write(formatRate(this.state.background ? BACKGROUND_TLM_HZ : this.opts.tlmHz), true);
        if (first === 'stop') {
          await this.write(formatStop(), true);
        }
        if (auto) {
          // §11.4.12 HB always on for this connection (auto ignores it, §11.5.3; it
          // returns a frozen manual takeover to auto). Then read the mode + lastReason
          // (§11.4.2): usually AUTO BOOT (§11.5.1). The app never sends MODE AUTO here (§11.4.11).
          await this.write(formatHb(APP_HB_S, setupInfo.auto?.hbMaxS), true);
          this.awaitingModeQuery = true;
          await this.write(formatMode(), true);
        }
      });
      if (!current()) {
        throw new ConnectStepError(at, 'failed', 'superseded');
      }
      this.connectLogLine(
        `connected in ${Date.now() - started} ms (mtu ${mtu}, ${info.proto ?? info.fw ?? 'no proto'})`,
      );
      this.set({
        status: 'connected',
        reconnectAttempt: 0,
        connectStep: null,
        connectFailure: null,
        error: null,
      });
      this.startWatchdog();
      return true;
    } catch (raw) {
      const e = toStepError(raw, at);
      if (e.message === 'superseded' || !current()) {
        // A newer connect / a user disconnect owns the link now: leave it alone.
        this.connectLogLine(`stopped at ${e.step} (superseded)`);
        return false;
      }
      this.connectLogLine(`FAILED at ${e.step}: ${e.kind} (${e.message})`);
      // Cancel the pending / half-open link (iOS keeps trying a connect forever otherwise).
      await withTimeout(this.transport.disconnect(device.id), STEP_TIMEOUT_MS.cleanup, 'cleanup').catch(() =>
        this.connectLogLine('cleanup: disconnect did not answer'),
      );
      if (!current()) {
        return false;
      }
      const failure = connectFailureFor(e.step, e.kind, e.message);
      this.set({ connectStep: null, connectFailure: failure });
      // A reconnect keeps trying (bounded, capped back-off) unless the device can never work.
      if (this.state.status === 'reconnecting' && e.kind !== 'unsupported' && e.kind !== 'bluetooth') {
        this.scheduleReconnect();
      } else {
        this.set({
          status: 'error',
          error: `连接失败：${e.message}`,
        });
      }
      return false;
    }
  }

  private requestInfoViaCommand(timeoutMs = STEP_TIMEOUT_MS['info-cmd']): Promise<DeviceInfo | null> {
    return new Promise(resolve => {
      const t = setTimeout(() => {
        this.infoWaiters = this.infoWaiters.filter(w => w !== done);
        resolve(null);
      }, timeoutMs);
      const done = (i: DeviceInfo) => {
        clearTimeout(t);
        resolve(i);
      };
      this.infoWaiters.push(done);
      this.write('INFO', true).catch(() => undefined);
    });
  }

  /**
   * User-initiated disconnect, no auto-reconnect. Older firmware: STOP first
   * (best effort, §5). ICD001-1: nothing first; auto keeps running and the
   * firmware zeroes a manual takeover and returns to auto on the drop
   * (§11.5.2; a latch stays, §11.6.2). Product decision 10/06 23:39.
   */
  async disconnect(): Promise<void> {
    this.userDisconnect = true;
    this.connectGen++; // a connect in flight stops at its next step
    this.clearReconnect();
    this.stopWatchdog();
    const dev = this.state.device;
    if (dev && this.state.status === 'connected') {
      if (this.state.autoSupported) {
        this.pushLog('# disconnect: no STOP (ICD001-1, device returns to auto, §11.5.2)');
      } else {
        await this.stop().catch(() => undefined);
      }
    }
    this.scheduler.clear();
    if (dev) {
      await this.transport.disconnect(dev.id).catch(() => undefined);
    }
    this.set({ status: 'disconnected', tlm: null, tlmAt: null, connectStep: null });
  }

  private onLinkLost(): void {
    this.scheduler.clear();
    this.stopWatchdog();
    this.clearModeTimer();
    if (this.state.autoSupported) {
      this.modeAtLinkLoss = effectiveMode(this.state);
      // §11.5.2: device returns to auto by itself (manual -> zero -> auto) unless latched.
      this.set({ modePending: null, hb: null });
    }
    this.pushLog('! link lost (firmware stops all actuators)');
    this.connectLogLine('link lost');
    if (this.userDisconnect || !this.state.device) {
      this.set({ status: 'disconnected', tlm: null, tlmAt: null });
      return;
    }
    this.set({
      status: 'reconnecting',
      tlm: null,
      tlmAt: null,
      reconnectAttempt: 0,
    });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const n = this.state.reconnectAttempt;
    const delays = this.opts.reconnectDelaysMs;
    if (n >= delays.length || !this.state.device) {
      // Cap reached: stop, show "Couldn't connect" + Retry (no endless loop).
      this.connectLogLine(`reconnect: gave up after ${n} attempts`);
      this.set({
        status: 'disconnected',
        error: '设备已断开，重连失败',
        connectStep: null,
        connectFailure:
          this.state.connectFailure ?? connectFailureFor('link', 'timeout', `gave up after ${n} attempts`),
      });
      return;
    }
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const dev = this.state.device;
      if (!dev || this.userDisconnect) {
        return;
      }
      this.set({ reconnectAttempt: n + 1 });
      // Reconnect restores the link only; actuators stay off (firmware stopped
      // them), the user has to move a control again.
      this.establish(dev);
    }, delays[n]);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdog = setInterval(() => this.set({}), 1000);
  }

  private stopWatchdog(): void {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }

  destroy(): void {
    this.clearReconnect();
    this.stopWatchdog();
    this.clearModeTimer();
    this.scheduler.clear();
    this.unsubs.forEach(u => u());
    this.listeners.clear();
  }

  // ------------------------------------------------------------ inbound

  private onBytes(bytes: number[]): void {
    for (const line of this.assembler.push(bytes)) {
      this.onLine(line);
    }
  }

  /** Exposed for tests / debug injection. */
  onLine(line: string): void {
    const p = parseLine(line);
    switch (p.kind) {
      case 'tlm': {
        const t = p.tlm;
        const now = Date.now();
        const safety = this.state.info?.safety;
        let lowBattery: boolean;
        if (t.lb !== null) {
          lowBattery = t.lb; // v0: firmware latch is authoritative
        } else {
          lowBattery = this.legacyLowBatteryStep(t.vbat, now);
        }
        let overTemp = t.ot;
        if (t.format === 'legacy' && safety) {
          if (!this.legacyOt && t.ntcC !== null && t.ntcC >= safety.ot.tripC) {
            this.legacyOt = true;
          } else if (this.legacyOt && (t.ntcC === null || t.ntcC < safety.ot.clearC)) {
            this.legacyOt = false;
          }
          overTemp = this.legacyOt;
        }
        const tripped =
          t.format === 'legacy' &&
          ((overTemp && !this.state.overTemp) || (lowBattery && !this.state.lowBattery));
        const patch = this.applyEstop(t.estop, 'tlm', { tlm: t, tlmAt: now, overTemp, lowBattery });
        if (this.state.autoSupported && t.mode) {
          Object.assign(patch, this.modeFromTlm(t.mode, now));
        }
        this.set(patch);
        if (tripped) {
          this.stopForSafety('legacy app-side latch');
        }
        this.heartbeat(now);
        return;
      }
      case 'info':
        this.set({ info: p.info });
        this.infoWaiters.splice(0).forEach(w => w(p.info));
        this.pushLog(`< ${line}`);
        return;
      case 'ok': {
        const ack = p.ack;
        if (ack?.cmd === 'ESTOP') {
          // direct reply to our ESTOP n (the only ESTOP acknowledgement, §9)
          this.set(this.applyEstop(ack.on, 'ok'));
        } else if (ack?.cmd === 'MODE') {
          this.onModeReply(ack.mode, ack.reason);
        } else if (ack?.cmd === 'HB') {
          this.set({ hb: ack.s });
        } else if (ack?.cmd === 'PZERO') {
          this.set({ pzero: { state: 'pending', at: Date.now() } });
        }
        this.set({ lastReply: line, lastAck: ack ? { ...ack, at: Date.now() } : this.state.lastAck });
        this.pushLog(ack ? `< ${line}` : `< ${line}   # malformed OK (§10.5)`);
        return;
      }
      case 'err': {
        // Firmware did not store the value; UI reverts sliders to tlm.lra /
        // tlm.vcm. Safety rejections map straight onto lock reasons (§7.5).
        const se = safetyErrOf(p);
        const now = Date.now();
        const ei = parseErr(p.args);
        // value not stored: the same value must be sendable again (dedupe reset)
        this.scheduler.forget();
        const patch: Partial<Icd001State> = {
          lastErr: { text: line, at: now },
          lastReply: line,
          lastErrInfo: { ...ei, at: now },
        };
        if (ei.verb === 'MODE' || ei.verb === 'AUTO') {
          // MODE AUTO refused while latched (§11.4.10): no switch; re-read the mode.
          patch.modePending = null;
          this.clearModeTimer();
          if (this.state.status === 'connected') {
            this.write(formatMode(), true).catch(() => undefined);
          }
        }
        if (ei.verb === 'PZERO') {
          // §11.7.7 ERR BUSY PZERO: a re-zero (e.g. the PAUSE key) is running and
          // continues; wait for its EVT PZERO. Other refusals: nothing pending.
          patch.pzero = ei.reason === 'BUSY' ? { state: 'pending', at: now } : null;
        }
        if (se) {
          patch.lastSafetyErr = { reason: se, at: now };
          // ERR ESTOP: state comes from EVT ESTOP / TLM (§8.3); the GET below
          // refreshes it. Expected for 0-value commands during E-stop (§8.6).
          if (se === 'OVERTEMP') {
            patch.overTemp = true;
          } else {
            patch.lowBattery = true;
          }
        }
        this.set(patch);
        this.pushLog(`< ${line}`);
        if (this.state.status === 'connected') {
          this.scheduler.enqueue('get', 'GET');
        }
        return;
      }
      case 'evt':
        this.pushLog(`< ${line}`);
        // device changed outputs on its own (START key, latch): resend on next input
        this.scheduler.forget();
        if (p.name === 'ESTOP') {
          // START key only (§9: never an echo of our ESTOP n): authoritative, device-originated
          this.set(this.applyEstop(p.args[0] === '1', 'evt'));
        } else if (p.name === 'OVERTEMP') {
          this.set({ overTemp: p.args[0] !== '0' });
        } else if (p.name === 'LOWBAT') {
          // v0: EVT LOWBAT 1 / EVT LOWBAT 0 (bare EVT LOWBAT treated as 1)
          this.set({ lowBattery: p.args[0] !== '0' });
        } else if (p.name === 'MODE') {
          const m = parseModeEvt(p.args);
          if (m) {
            this.onModeEvt(m.mode, m.reason);
          }
        } else if (p.name === 'PZERO') {
          this.set({ pzero: { state: 'done', at: Date.now() } });
        }
        // `EVT HOST_TIMEOUT STOP` (§11.4.12, superseded by §11.5.3): outputs zeroed; TLM follows.
        return;
      default:
        this.pushLog(`< ${line}`);
    }
  }

  // ------------------------------------------------------------ outbound

  private async write(line: string, urgent: boolean): Promise<void> {
    const dev = this.state.device;
    if (!dev) {
      throw new Error('no device');
    }
    this.pushLog(`> ${line}`);
    this.lastWriteAt = Date.now();
    // v0 buffers until \n so a long command may span writes; legacy may not.
    const allowSplit = this.state.info ? !this.state.info.legacy : false;
    await this.transport.write(dev.id, encodeCommand(line), urgent, allowSplit);
  }

  private get linkUp(): boolean {
    return this.state.status === 'connected' && !!this.state.device;
  }

  /**
   * Non-zero actuator values are refused while locked; zero always allowed.
   * ICD001-1: only in (or switching to) manual; the firmware refuses every
   * actuator command in auto with `ERR MODE AUTO <verb>` (§11.4.9).
   */
  private canActuate(value: number): boolean {
    if (this.state.autoSupported && effectiveMode(this.state) !== 'manual') {
      return false;
    }
    return this.linkUp && (value <= 0 || !this.state.locked);
  }

  /** Wing LRA group intensity 0–100 (throttled ~10 Hz, latest value wins). */
  setLra(target: LraTarget, value: number): boolean {
    const wings = this.state.info?.modules.wings;
    if (!wings || !this.canActuate(value)) {
      return false;
    }
    if (target !== 'ALL' && !wings.groups.some(g => g.id === target)) {
      return false;
    }
    if (target === 'ALL') {
      this.enqueueWing('ALL', formatLra('ALL', value));
    } else {
      this.enqueueWing(target, formatLra(target, value));
    }
    return true;
  }

  /**
   * Wing rhythm done in firmware: `LPULSE t v onMs offMs` (v0 only). A later
   * setLra on the same group cancels the rhythm (firmware rule); both share one
   * throttle key so only the latest intent per group is sent.
   */
  setLpulse(target: LraTarget, value: number, onMs: number, offMs: number): boolean {
    const wings = this.state.info?.modules.wings;
    if (!wings || !wings.lpulse || !this.canActuate(value)) {
      return false;
    }
    if (target !== 'ALL' && !wings.groups.some(g => g.id === target)) {
      return false;
    }
    this.enqueueWing(target, formatLpulse(target, value, onMs, offMs, wings.lpulse));
    return true;
  }

  private enqueueWing(target: LraTarget, line: string): void {
    if (target === 'ALL') {
      // An ALL supersedes pending single-group values.
      this.scheduler.drop('wing:A');
      this.scheduler.drop('wing:B');
      this.scheduler.forget('wing:A', 'wing:B');
    } else {
      this.scheduler.forget('wing:ALL');
    }
    // dedupe: a slider release repeating the last streamed value is not resent (audit F10)
    this.scheduler.enqueue(`wing:${target}`, line, true);
  }

  /** Shared LRA drive frequency (engineering only per protocol). */
  setFreq(hz: number): boolean {
    const wings = this.state.info?.modules.wings;
    if (!wings || !this.linkUp || this.state.locked) {
      return false;
    }
    this.scheduler.enqueue('freq', formatFreq(hz, wings.freq));
    return true;
  }

  /**
   * Voice-coil pulse beat frequency in Hz (this IS the intensity). 0 = off.
   * Clamped to INFO ch.vcm range (legacy fallback 2–20 Hz via `VCM 1 ms`).
   */
  setVcmHz(hz: number): boolean {
    const caps = this.state.info?.modules.vcm;
    if (!caps || !this.canActuate(hz)) {
      return false;
    }
    this.scheduler.enqueue('vcm', formatVcmHz(hz, caps), true);
    return true;
  }

  /** STOP all actuators immediately (drops queued commands). */
  async stop(): Promise<void> {
    if (!this.state.device || (this.state.status !== 'connected' && this.state.status !== 'connecting')) {
      this.scheduler.clear();
      return;
    }
    await this.scheduler.sendNow(formatStop());
  }

  async setEstop(on: boolean): Promise<void> {
    if (!this.linkUp) {
      return;
    }
    // State and source follow the `OK ESTOP n` reply (§9), not the send.
    await this.scheduler.sendNow(formatEstop(on));
  }

  /**
   * STOP while offline: firmware already stopped on disconnect (§5); make sure
   * a STOP follows RATE on the next connect. Does not downgrade a queued ESTOP.
   */
  requestStopOnConnect(): void {
    if (this.onConnectAction !== 'estop') {
      this.onConnectAction = 'stop';
    }
    this.pushLog('# STOP queued for next connect');
  }

  /**
   * Stop all while offline (advanced control, design v4): the firmware already
   * stopped everything when the link dropped (§5); on the next connect the
   * first command is `ESTOP 1`, so outputs stay locked until the user taps
   * Unlock (ESTOP 0) or presses the START key (§8.3).
   */
  requestEstopOnConnect(): void {
    this.onConnectAction = 'estop';
    this.pushLog('# ESTOP 1 queued for next connect');
  }

  /**
   * The page that queued the e-stop is gone (no Unlock UI left on screen):
   * downgrade the queued ESTOP 1 to a plain STOP so the device does not come
   * back latched behind another page.
   */
  downgradeQueuedEstop(): void {
    if (this.onConnectAction === 'estop') {
      this.onConnectAction = 'stop';
      this.pushLog('# queued ESTOP 1 -> STOP (left advanced control)');
    }
  }

  /** Pending one-shot action for the next connect (UI hint / tests). */
  get queuedOnConnect(): 'estop' | 'stop' | null {
    return this.onConnectAction;
  }

  /** Legacy-only low-battery latch: trip < tripV; clear > clearV held holdS (§8.2). */
  private legacyLowBatteryStep(vbat: number | null, now: number): boolean {
    const lb = this.state.info?.safety.lb;
    if (!lb || vbat === null) {
      // not measured (e.g. dev board on USB without battery): no latch
      this.legacyLbAboveSince = null;
      this.legacyLowBat = false;
      return false;
    }
    if (!this.legacyLowBat) {
      if (vbat < lb.tripV) {
        this.legacyLowBat = true;
        this.legacyLbAboveSince = null;
      }
    } else if (vbat > lb.clearV) {
      if (this.legacyLbAboveSince === null) {
        this.legacyLbAboveSince = now;
      }
      if (now - this.legacyLbAboveSince >= lb.holdS * 1000) {
        this.legacyLowBat = false;
        this.legacyLbAboveSince = null;
      }
    } else {
      this.legacyLbAboveSince = null;
    }
    return this.legacyLowBat;
  }

  /** Call when leaving the control page or when the app goes to background. */
  stopForSafety(reason: string): void {
    this.pushLog(`# auto STOP (${reason})`);
    this.stop().catch(() => undefined);
  }

  // ------------------------------------------------------------ ICD001-1 modes

  /**
   * Switch mode (§11.1, §11.4). Unsent slider values are dropped and the
   * command goes out at once; the UI follows `modePending` until `OK MODE x`
   * (or TLM shows x). MODE AUTO is not sent while latched (would be
   * `ERR <latch> MODE`, §11.4.10). Returns false when not sent.
   */
  setMode(m: DeviceMode): boolean {
    if (!this.state.autoSupported || !this.linkUp) {
      return false;
    }
    if (m === 'auto' && (this.state.estop || this.state.overTemp || this.state.lowBattery)) {
      return false;
    }
    this.set({ modePending: m });
    this.clearModeTimer();
    this.modeTimer = setTimeout(() => {
      this.modeTimer = null;
      if (this.state.modePending !== null) {
        this.set({ modePending: null });
        if (this.linkUp) {
          this.write(formatMode(), true).catch(() => undefined);
        }
      }
    }, MODE_REPLY_TIMEOUT_MS);
    // sendNow drops pending slider commands (§11.4.9 race: none can follow MODE AUTO)
    this.scheduler.sendNow(formatMode(m)).catch(() => undefined);
    return true;
  }

  /** §11.4.14: re-zero pressure (auto only). */
  pzero(): boolean {
    if (!this.state.autoSupported || !this.linkUp || effectiveMode(this.state) !== 'auto') {
      return false;
    }
    this.scheduler.enqueue('pzero', formatPzero());
    return true;
  }

  /**
   * Leaving the control page or app background. ICD001-1 (§11.6.3): auto ->
   * nothing (the device keeps following the body); manual takeover -> hand
   * back with `MODE AUTO` (MANUAL_LEAVE_ACTION); latched -> `STOP` (MODE AUTO
   * would be refused; outputs are 0 anyway). Older firmware: `STOP` (§5).
   */
  releaseControl(reason: string, action: 'handback' | 'stop' = MANUAL_LEAVE_ACTION): void {
    if (!this.state.autoSupported) {
      this.stopForSafety(reason);
      return;
    }
    const m = effectiveMode(this.state);
    if (m === 'auto' && this.linkUp) {
      this.pushLog(`# ${reason}: auto keeps running (no STOP, §11.3.7)`);
      return;
    }
    const latched = this.state.estop || this.state.overTemp || this.state.lowBattery;
    if (action === 'handback' && this.linkUp && !latched) {
      this.pushLog(`# ${reason}: hand back to auto (§11.6.3)`);
      this.setMode('auto');
      return;
    }
    this.stopForSafety(reason);
  }

  /** App went to the background (useIcd001): release control, slow TLM (ICD001-1). */
  onAppBackground(): void {
    this.set({ background: true });
    if (!this.state.autoSupported) {
      this.stopForSafety('app background');
      return;
    }
    this.releaseControl('app background');
    if (this.linkUp) {
      this.write(formatRate(BACKGROUND_TLM_HZ), true).catch(() => undefined);
    }
  }

  onAppForeground(): void {
    const was = this.state.background;
    this.set({ background: false });
    if (was && this.state.autoSupported && this.linkUp) {
      this.write(formatRate(this.opts.tlmHz), true).catch(() => undefined);
    }
  }

  /** PING driven by TLM arrival (timers do not run in the iOS background). */
  private heartbeat(now: number): void {
    if (!this.state.autoSupported || !this.state.hb || !this.linkUp) {
      return;
    }
    if (now - this.lastWriteAt >= PING_IDLE_MS) {
      this.lastWriteAt = now;
      this.scheduler.enqueue('ping', formatPing());
    }
  }

  private clearModeTimer(): void {
    if (this.modeTimer) {
      clearTimeout(this.modeTimer);
      this.modeTimer = null;
    }
  }

  private change(to: DeviceMode, reason: string | null, via: ModeChange['via']): Partial<Icd001State> {
    const from = this.state.mode;
    return from === to && via !== 'query'
      ? {}
      : { modeChange: { from, to, reason, via, at: Date.now(), id: ++this.modeSeq } };
  }

  /** TLM `mode`: authoritative unless a change is in flight (then it confirms it). */
  private modeFromTlm(m: DeviceMode, _now: number): Partial<Icd001State> {
    const pending = this.state.modePending;
    if (pending !== null) {
      if (m !== pending) {
        return {}; // frame predates our MODE command (strict order, §11.4.9)
      }
      this.clearModeTimer();
      return { mode: m, modePending: null, ...this.change(m, this.state.modeReason, 'tlm') };
    }
    if (m === this.state.mode) {
      return {};
    }
    this.scheduler.clear(); // device switched on its own: never let a queued value follow
    return { mode: m, ...(this.state.mode === null ? {} : this.change(m, null, 'tlm')) };
  }

  private onModeReply(m: DeviceMode, reason: string | null): void {
    const patch: Partial<Icd001State> = { mode: m };
    if (reason) {
      patch.modeReason = reason;
    }
    if (this.state.modePending === m) {
      patch.modePending = null;
      this.clearModeTimer();
    }
    if (this.awaitingModeQuery && reason) {
      this.awaitingModeQuery = false;
      // §11.5.2 / §11.8: a takeover (or an E-stop latch) lost to a BLE drop or an
      // HB timeout comes back as AUTO BLE_DISCONNECT / AUTO HOST_TIMEOUT.
      if (
        this.modeAtLinkLoss === 'manual' &&
        m === 'auto' &&
        (reason === 'BLE_DISCONNECT' || reason === 'HOST_TIMEOUT')
      ) {
        patch.modeChange = {
          from: 'manual',
          to: 'auto',
          reason,
          via: 'query',
          at: Date.now(),
          id: ++this.modeSeq,
        };
      }
      this.modeAtLinkLoss = null;
    }
    this.set(patch);
  }

  private onModeEvt(m: DeviceMode, reason: string | null): void {
    const patch: Partial<Icd001State> = { mode: m, modeReason: reason, ...this.change(m, reason, 'evt') };
    const prev = this.state.modeChange;
    if (!patch.modeChange && prev && prev.to === m && prev.via === 'tlm' && prev.reason === null) {
      // a TLM frame showed the switch before its EVT: attach the reason now
      patch.modeChange = { ...prev, reason, via: 'evt', at: Date.now(), id: ++this.modeSeq };
    }
    if (this.state.modePending === m) {
      patch.modePending = null;
      this.clearModeTimer();
    }
    if (reason !== 'CMD') {
      this.scheduler.clear(); // device-originated switch: drop queued slider values
    }
    this.set(patch);
  }
}

export function computeLockReasons(s: Icd001State, staleMs: number): LockReason[] {
  const r: LockReason[] = [];
  if (s.status !== 'connected') {
    r.push('disconnected');
    return r;
  }
  if (!s.info) {
    r.push('noinfo');
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
  if (s.tlmAt === null || Date.now() - s.tlmAt > staleMs) {
    r.push('stale');
  }
  return r;
}

export const LOCK_REASON_TEXT: Record<LockReason, string> = {
  disconnected: '设备未连接',
  noinfo: '未读到设备信息',
  estop: '急停已锁定',
  overtemp: '温度过高，已暂停',
  lowbat: '电量过低',
  stale: '等待设备数据…',
};
