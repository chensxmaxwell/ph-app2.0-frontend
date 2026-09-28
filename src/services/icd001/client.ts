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
  Telemetry,
  VBAT_LOW_CUT,
  formatEstop,
  formatFreq,
  formatLra,
  formatRate,
  formatStop,
  formatVcmHz,
  parseInfo,
  parseLine,
} from './protocol';
import { CommandScheduler } from './throttle';
import { decodeUtf8, encodeUtf8 } from './utf8';

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
  overTemp: boolean;
  lowBattery: boolean;
  /** Actuator controls must be disabled when true (see lockReasons). */
  locked: boolean;
  lockReasons: LockReason[];
  lastErr: { text: string; at: number } | null;
  lastReply: string | null;
  reconnectAttempt: number;
  error: string | null;
  /** Last ~40 raw lines in/out, for the debug screen. */
  log: string[];
}

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
  private evtLowBat = false;
  private readonly opts: Required<Icd001ClientOptions>;

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
      overTemp: false,
      lowBattery: false,
      locked: true,
      lockReasons: ['disconnected'],
      lastErr: null,
      lastReply: null,
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
      this.set({ info, tlm: null, tlmAt: null, estop: false, overTemp: false });
      this.evtLowBat = false;
      await this.write(formatRate(this.opts.tlmHz), true);
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
    const units = this.state.info?.vcmUnits ?? 'halfMs';
    const p = parseLine(line, units);
    switch (p.kind) {
      case 'tlm': {
        const t = p.tlm;
        if (this.evtLowBat && t.vbat !== null && t.vbat >= VBAT_LOW_CUT + 0.05) {
          this.evtLowBat = false;
        }
        this.set({
          tlm: t,
          tlmAt: Date.now(),
          estop: t.estop,
          overTemp: t.ot,
          lowBattery: this.evtLowBat || (t.vbat !== null && t.vbat < VBAT_LOW_CUT),
        });
        return;
      }
      case 'info':
        this.set({ info: p.info });
        this.infoWaiters.splice(0).forEach(w => w(p.info));
        this.pushLog(`< ${line}`);
        return;
      case 'ok':
        if (p.args[0]?.toUpperCase() === 'ESTOP') {
          this.set({ estop: p.args[1] === '1' });
        }
        this.set({ lastReply: line });
        this.pushLog(`< ${line}`);
        return;
      case 'err':
        // UI reverts sliders to tlm.lra / tlm.vcm; ask for a fresh frame now.
        this.set({ lastErr: { text: line, at: Date.now() }, lastReply: line });
        this.pushLog(`< ${line}`);
        if (this.state.status === 'connected') {
          this.scheduler.enqueue('get', 'GET');
        }
        return;
      case 'evt':
        this.pushLog(`< ${line}`);
        if (p.name === 'ESTOP') {
          this.set({ estop: p.args[0] === '1' });
        } else if (p.name === 'OVERTEMP') {
          this.set({ overTemp: p.args[0] !== '0' });
        } else if (p.name === 'LOWBAT') {
          this.evtLowBat = true;
          this.set({ lowBattery: true });
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
    await this.transport.write(dev.id, encodeUtf8(line), urgent);
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
      // An ALL supersedes pending single-group values.
      this.scheduler.drop('lra:A');
      this.scheduler.drop('lra:B');
      this.scheduler.enqueue('lra:ALL', formatLra('ALL', value));
    } else {
      this.scheduler.enqueue(`lra:${target}`, formatLra(target, value));
    }
    return true;
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
    this.scheduler.enqueue('vcm', formatVcmHz(hz, caps));
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
    await this.scheduler.sendNow(formatEstop(on));
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
