/**
 * Icd001Client: framework-agnostic device session for ICD-001 / H1.1.
 * scan -> connect -> MTU -> INFO -> TLM stream, typed state, throttled command
 * API, safety interlocks, auto-reconnect. React binding lives in useIcd001.ts.
 */
import {
  DeviceInfo,
  ICD001_DEFAULT_TLM_HZ,
  LineAssembler,
  LraTarget,
  OkReply,
  Telemetry,
  SafetyErr,
  encodeCommand,
  formatEstop,
  formatFreq,
  formatLpulse,
  formatLra,
  formatRate,
  formatStop,
  formatVcmHz,
  parseInfo,
  parseLine,
  safetyErrOf,
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
  /** Last ~40 raw lines in/out, for the debug screen. */
  log: string[];
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

export class Icd001Client {
  private state: Icd001State;
  private listeners = new Set<Listener>();
  private assembler = new LineAssembler();
  private scheduler: CommandScheduler;
  private unsubs: Array<() => void> = [];
  private userDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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
  /**
   * Single place E-stop state changes. The message type tells who caused it
   * (PROTOCOL §9, hardware-confirmed; no time windows):
   *  - `OK ESTOP n`  only ever answers the app's own `ESTOP n`   -> 'app'
   *  - `EVT ESTOP n` is sent only when the device START key is pressed
   *                  (never as an echo of `ESTOP n`)              -> 'device'
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
      log: [],
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
      reconnectAttempt: 0,
    });
    return this.establish(device);
  }

  private async establish(device: DiscoveredDevice): Promise<boolean> {
    this.assembler.reset();
    this.scheduler.clear();
    try {
      await this.transport.init();
      const { mtu } = await this.transport.connect(device.id);
      this.set({ mtu });
      let info: DeviceInfo | null = null;
      try {
        info = parseInfo(decodeUtf8(await this.transport.readInfo(device.id)));
      } catch {
        info = null;
      }
      if (!info) {
        info = await this.requestInfoViaCommand();
      }
      if (!info) {
        throw new Error('设备没有返回 INFO');
      }
      this.set({
        info,
        tlm: null,
        tlmAt: null,
        estop: false,
        estopSource: null,
        overTemp: false,
        lowBattery: false,
      });
      this.legacyLowBat = false;
      this.legacyLbAboveSince = null;
      this.legacyOt = false;
      const first = this.onConnectAction;
      this.onConnectAction = null;
      if (first === 'estop') {
        // State/source follow the `OK ESTOP 1` reply (§9), like setEstop().
        await this.write(formatEstop(true), true);
      }
      await this.write(formatRate(this.opts.tlmHz), true);
      if (first === 'stop') {
        await this.write(formatStop(), true);
      }
      this.set({ status: 'connected', reconnectAttempt: 0 });
      this.startWatchdog();
      return true;
    } catch (e) {
      await this.transport.disconnect(device.id).catch(() => undefined);
      if (this.state.status === 'reconnecting') {
        this.scheduleReconnect();
      } else {
        this.set({
          status: 'error',
          error: `连接失败：${e instanceof Error ? e.message : String(e)}`,
        });
      }
      return false;
    }
  }

  private requestInfoViaCommand(timeoutMs = 2000): Promise<DeviceInfo | null> {
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

  /** User-initiated disconnect: STOP first (best effort), no auto-reconnect. */
  async disconnect(): Promise<void> {
    this.userDisconnect = true;
    this.clearReconnect();
    this.stopWatchdog();
    const dev = this.state.device;
    if (dev && this.state.status === 'connected') {
      await this.stop().catch(() => undefined);
    }
    this.scheduler.clear();
    if (dev) {
      await this.transport.disconnect(dev.id).catch(() => undefined);
    }
    this.set({ status: 'disconnected', tlm: null, tlmAt: null });
  }

  private onLinkLost(): void {
    this.scheduler.clear();
    this.stopWatchdog();
    this.pushLog('! link lost (firmware stops all actuators)');
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
      this.set({ status: 'disconnected', error: '设备已断开，重连失败' });
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
        this.set(this.applyEstop(t.estop, 'tlm', { tlm: t, tlmAt: now, overTemp, lowBattery }));
        if (tripped) {
          this.stopForSafety('legacy app-side latch');
        }
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
        // value not stored: the same value must be sendable again (dedupe reset)
        this.scheduler.forget();
        const patch: Partial<Icd001State> = { lastErr: { text: line, at: now }, lastReply: line };
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
        }
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
    // v0 buffers until \n so a long command may span writes; legacy may not.
    const allowSplit = this.state.info ? !this.state.info.legacy : false;
    await this.transport.write(dev.id, encodeCommand(line), urgent, allowSplit);
  }

  private get linkUp(): boolean {
    return this.state.status === 'connected' && !!this.state.device;
  }

  /** Non-zero actuator values are refused while locked; zero always allowed. */
  private canActuate(value: number): boolean {
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
