/**
 * Simulator for ICD-001 / H1.1 so the advanced-control UI can be built and
 * screenshotted without hardware. It emulates the firmware text protocol:
 * INFO characteristic, `;`/`\n` separated commands, OK/ERR replies, EVT lines,
 * and TLM JSON pushed at RATE Hz and chunked to MTU-3 bytes (exercising the
 * app-side line reassembly).
 *
 * Variants:
 *  - 'icd1'  = PROTOCOL-ICD001 v0 (prod/ch in INFO, VHZ, vcm:[on,hz], ot, 4 PPG)
 *  - 'h11'   = h11-demo-ble as flashed on H11-91B1 today (legacy INFO,
 *              VCM on halfMs, vcm:[on,halfMs], 3 PPG, VHZ -> ERR UNKNOWN)
 */
import { clamp } from './protocol';
import { decodeUtf8, encodeUtf8 } from './utf8';

import type { ConnectResult, DiscoveredDevice, Icd001Transport } from './transport';

export type MockVariant = 'icd1' | 'h11';

export interface MockDeviceSnapshot {
  lra: [number, number];
  freq: number;
  vcmOn: boolean;
  vcmHz: number;
  estop: boolean;
  ot: boolean;
  ntc: number;
  vbat: number;
  rate: number;
}

export class MockIcd001Device {
  lra: [number, number] = [0, 0];
  freq = 170;
  vcmOn = false;
  vcmHz = 10; // stored as Hz; legacy variant reports 500/hz as half-period
  estop = false;
  ot = false;
  lowbat = false;
  auto = false;
  rate = 5;
  ntc = 33.5;
  vbat = 4.05;
  /** Force temperature (for testing the over-temp lock in UI). null = simulate. */
  ntcOverride: number | null = null;
  readonly startedAt: number;
  commandLog: string[] = [];

  constructor(
    readonly variant: MockVariant,
    readonly name: string,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.startedAt = now();
  }

  get vcmRange(): { min: number; max: number } {
    return this.variant === 'icd1' ? { min: 2, max: 50 } : { min: 2, max: 20 };
  }

  infoJson(): string {
    if (this.variant === 'h11') {
      return JSON.stringify({
        fw: 'h11-demo-ble',
        ver: 'sim',
        mux: 1,
        adsA: 1,
        adsB: 1,
        imu: 1,
        ppg: [1, 1, 1],
      });
    }
    // NOTE: the shape of `ch` beyond `vcm` is an app-side proposal; see ledger.
    return JSON.stringify({
      prod: 'ICD-001',
      hw: 'H1.1',
      fw: 'icd001-sim',
      ver: '0.0-sim',
      mux: 1,
      adsA: 1,
      adsB: 1,
      imu: 1,
      ppg: [1, 1, 1, 1],
      ch: {
        lra: { A: '上翼', B: '下翼' },
        freq: { min: 100, max: 300, def: 170 },
        vcm: { min: 2, max: 50, def: 10 },
        ppg: ['翼左', '翼右', '翼中', '跳蛋'],
        egg: { ppg: 3, act: 0 },
      },
    });
  }

  private allStop(): void {
    this.lra = [0, 0];
    this.vcmOn = false;
    this.auto = false;
  }

  private actuatorLocked(): string | null {
    if (this.variant === 'h11') {
      return null; // legacy firmware accepts commands; outputs gated internally
    }
    if (this.estop) {
      return 'ERR ESTOP';
    }
    if (this.ot) {
      return 'ERR OVERTEMP';
    }
    if (this.lowbat) {
      return 'ERR LOWBAT';
    }
    return null;
  }

  /** Handle one BLE write; returns reply lines (without `\n`). */
  handleWrite(text: string): string[] {
    const out: string[] = [];
    for (const part of text.split(/[\n;]/)) {
      const c = part.trim();
      if (c) {
        this.commandLog.push(c);
        out.push(...this.handleCmd(c));
      }
    }
    return out;
  }

  private handleCmd(c: string): string[] {
    const p = c.toUpperCase().split(/\s+/);
    const op = p[0];
    const a1 = p[1];
    const v1 = a1 !== undefined ? parseInt(a1, 10) : NaN;
    const v2 = p[2] !== undefined ? parseInt(p[2], 10) : NaN;
    switch (op) {
      case 'PING':
        return ['OK PONG'];
      case 'INFO':
        return [this.infoJson()];
      case 'GET':
        return [this.tlmJson()];
      case 'STOP':
        this.allStop();
        return ['OK STOP'];
      case 'ESTOP':
        this.estop = a1 === undefined ? true : v1 !== 0;
        if (this.estop) {
          this.allStop();
        }
        return [this.estop ? 'OK ESTOP 1' : 'OK ESTOP 0'];
      case 'AUTO':
        if (Number.isNaN(v1)) {
          return ['ERR AUTO 0|1'];
        }
        this.allStop();
        this.auto = v1 !== 0;
        return [`OK AUTO ${this.auto ? 1 : 0}`];
      case 'RATE':
        if (Number.isNaN(v1) || v1 < 0 || v1 > 20) {
          return ['ERR RATE 0-20'];
        }
        this.rate = v1;
        return [`OK RATE ${v1}`];
      case 'FREQ':
        if (Number.isNaN(v1) || v1 < 100 || v1 > 300) {
          return ['ERR FREQ 100-300'];
        }
        this.freq = v1;
        return [`OK FREQ ${v1}`];
      case 'LRA': {
        if (Number.isNaN(v2) || v2 < 0 || v2 > 100) {
          return ['ERR LRA <0|1|B> <0-100>'];
        }
        const locked = v2 > 0 ? this.actuatorLocked() : null;
        if (locked) {
          return [locked];
        }
        this.auto = false;
        const t = a1;
        if (t === '0' || t === 'CORE' || (this.variant === 'icd1' && t === 'A')) {
          this.lra[0] = v2;
        } else if (t === '1' || t === 'WING' || (this.variant === 'icd1' && t === 'B')) {
          this.lra[1] = v2;
        } else if (t === 'BOTH' || t === 'ALL' || (this.variant === 'h11' && t === 'B')) {
          this.lra = [v2, v2];
        } else {
          return ['ERR LRA target'];
        }
        return [`OK LRA ${this.lra[0]} ${this.lra[1]}`];
      }
      case 'VCM': {
        if (Number.isNaN(v1)) {
          return ['ERR VCM 0|1 [halfMs 25-250]'];
        }
        const locked = v1 !== 0 ? this.actuatorLocked() : null;
        if (locked) {
          return [locked];
        }
        this.auto = false;
        this.vcmOn = v1 !== 0;
        if (!Number.isNaN(v2)) {
          this.vcmHz = 500 / clamp(v2, 25, 250);
        }
        return [`OK VCM ${this.vcmOn ? 1 : 0} ${Math.round(500 / this.vcmHz)}`];
      }
      case 'VHZ': {
        if (this.variant === 'h11') {
          return ['ERR UNKNOWN VHZ'];
        }
        const { min, max } = this.vcmRange;
        if (Number.isNaN(v1) || (v1 !== 0 && (v1 < min || v1 > max))) {
          return [`ERR VHZ 0|${min}-${max}`];
        }
        const locked = v1 !== 0 ? this.actuatorLocked() : null;
        if (locked) {
          return [locked];
        }
        this.auto = false;
        this.vcmOn = v1 !== 0;
        if (v1 !== 0) {
          this.vcmHz = v1;
        }
        return [`OK VHZ ${this.vcmOn ? v1 : 0}`];
      }
      default:
        return [`ERR UNKNOWN ${op}`];
    }
  }

  /** Advance simulated physics by dt seconds; returns EVT lines. */
  step(dtS: number): string[] {
    const evts: string[] = [];
    const drive = (this.lra[0] + this.lra[1]) / 200 + (this.vcmOn ? 0.5 : 0);
    if (this.ntcOverride !== null) {
      this.ntc = this.ntcOverride;
    } else {
      const target = 33.5 + 4 * drive;
      this.ntc += (target - this.ntc) * Math.min(1, dtS / 30);
    }
    this.vbat = Math.max(3.3, this.vbat - dtS * (0.00005 + 0.0002 * drive));
    if (this.variant === 'icd1') {
      if (!this.ot && this.ntc >= 42) {
        this.ot = true;
        this.allStop();
        evts.push('EVT OVERTEMP 1');
      } else if (this.ot && this.ntc < 39) {
        this.ot = false;
        evts.push('EVT OVERTEMP 0');
      }
      if (!this.lowbat && this.vbat < 3.4) {
        this.lowbat = true;
        this.allStop();
        evts.push('EVT LOWBAT');
      }
    }
    return evts;
  }

  /** Emulates the START key on the device body. */
  pressStartKey(): string {
    this.estop = !this.estop;
    if (this.estop) {
      this.allStop();
    }
    return `EVT ESTOP ${this.estop ? 1 : 0}`;
  }

  tlmJson(): string {
    const t = this.now() - this.startedAt;
    const nPpg = this.variant === 'icd1' ? 4 : 3;
    const warm = t > 3000;
    const ppg = Array.from({ length: nPpg }, (_, i) => [
      52000 + i * 1500 + Math.round(Math.sin(t / 160 + i) * 800),
      1,
      warm ? 70 + ((i * 3 + Math.floor(t / 4000)) % 6) : 0,
    ]);
    const vcmOut = this.vcmOn && !this.estop ? 1 : 0;
    const vcmVal = this.variant === 'icd1' ? Math.round(this.vcmHz) : Math.round(500 / this.vcmHz);
    const obj: Record<string, unknown> = {
      t,
      ppg,
      fsr: [0, 0, 0, 0, 0],
      hall: 0,
      ntc: Math.round(this.ntc * 10) / 10,
      vbat: Math.round(this.vbat * 100) / 100,
      acc: [0.01, -0.02, 1.0],
      gyr: [0, 0, 0],
      lra: [this.lra[0], this.lra[1]],
      f: this.freq,
      vcm: [vcmOut, vcmVal],
      auto: this.auto ? 1 : 0,
      estop: this.estop ? 1 : 0,
    };
    if (this.variant === 'icd1') {
      obj.ot = this.ot ? 1 : 0;
    }
    return JSON.stringify(obj);
  }

  snapshot(): MockDeviceSnapshot {
    return {
      lra: [this.lra[0], this.lra[1]],
      freq: this.freq,
      vcmOn: this.vcmOn,
      vcmHz: this.vcmHz,
      estop: this.estop,
      ot: this.ot,
      ntc: this.ntc,
      vbat: this.vbat,
      rate: this.rate,
    };
  }
}

type Timer = ReturnType<typeof setInterval>;

/** In-memory transport backed by MockIcd001Device instances. */
export class MockIcd001Transport implements Icd001Transport {
  readonly kind = 'mock' as const;
  readonly devices: Map<string, MockIcd001Device>;
  private notifyCbs = new Set<(id: string, bytes: number[]) => void>();
  private discCbs = new Set<(id: string) => void>();
  private connected = new Map<string, { mtu: number; timer: Timer; lastStep: number; lastTlm: number }>();

  constructor(
    devices?: MockIcd001Device[],
    private readonly opts: { mtu?: number; connectDelayMs?: number } = {},
  ) {
    const list = devices ?? [
      new MockIcd001Device('icd1', 'ICD1-5A3C'),
      new MockIcd001Device('h11', 'H11-91B1'),
    ];
    this.devices = new Map(list.map(d => [`sim-${d.name}`, d]));
  }

  async init(): Promise<void> {}

  async startScan(onDevice: (d: DiscoveredDevice) => void): Promise<void> {
    let i = 0;
    for (const [id, d] of this.devices) {
      const kind = d.name.startsWith('ICD1-') ? 'product' : 'devboard';
      setTimeout(
        () =>
          onDevice({
            id,
            name: d.name,
            rssi: -48 - i * 9,
            kind,
            simulated: true,
          }),
        150 + i++ * 200,
      );
    }
  }

  async stopScan(): Promise<void> {}

  async connect(id: string): Promise<ConnectResult> {
    const dev = this.devices.get(id);
    if (!dev) {
      throw new Error(`Unknown simulated device ${id}`);
    }
    await new Promise<void>(r => setTimeout(() => r(), this.opts.connectDelayMs ?? 400));
    const mtu = this.opts.mtu ?? 185; // iOS typically lands on 185
    const now = Date.now();
    const state = {
      mtu,
      lastStep: now,
      lastTlm: now,
      timer: 0 as unknown as Timer,
    };
    state.timer = setInterval(() => this.tick(id), 25);
    this.connected.set(id, state);
    return { mtu };
  }

  async disconnect(id: string): Promise<void> {
    this.drop(id, false);
  }

  /** Simulate link loss (out of range / board reset). Firmware stops motors. */
  simulateLinkLoss(id: string): void {
    this.drop(id, true);
  }

  private drop(id: string, notify: boolean): void {
    const c = this.connected.get(id);
    if (!c) {
      return;
    }
    clearInterval(c.timer);
    this.connected.delete(id);
    const dev = this.devices.get(id);
    dev?.handleWrite('STOP'); // firmware: BLE disconnect -> stop all
    if (notify) {
      this.discCbs.forEach(cb => cb(id));
    }
  }

  async readInfo(id: string): Promise<number[]> {
    const dev = this.requireConnected(id);
    return encodeUtf8(dev.infoJson());
  }

  async write(id: string, bytes: number[]): Promise<void> {
    const dev = this.requireConnected(id);
    const c = this.connected.get(id);
    if (c && bytes.length > c.mtu - 3) {
      throw new Error('write exceeds MTU');
    }
    const replies = dev.handleWrite(decodeUtf8(bytes));
    setTimeout(() => replies.forEach(r => this.sendLine(id, r)), 5);
  }

  onNotify(cb: (id: string, bytes: number[]) => void): () => void {
    this.notifyCbs.add(cb);
    return () => this.notifyCbs.delete(cb);
  }

  onDisconnected(cb: (id: string) => void): () => void {
    this.discCbs.add(cb);
    return () => this.discCbs.delete(cb);
  }

  /** Emulate the device START key (toggle E-stop). */
  pressStartKey(id: string): void {
    const dev = this.devices.get(id);
    if (dev && this.connected.has(id)) {
      this.sendLine(id, dev.pressStartKey());
    }
  }

  private requireConnected(id: string): MockIcd001Device {
    const dev = this.devices.get(id);
    if (!dev || !this.connected.has(id)) {
      throw new Error('Not connected');
    }
    return dev;
  }

  private tick(id: string): void {
    const c = this.connected.get(id);
    const dev = this.devices.get(id);
    if (!c || !dev) {
      return;
    }
    const now = Date.now();
    dev.step((now - c.lastStep) / 1000).forEach(e => this.sendLine(id, e));
    c.lastStep = now;
    if (dev.rate > 0 && now - c.lastTlm >= 1000 / dev.rate) {
      c.lastTlm = now;
      this.sendLine(id, dev.tlmJson());
    }
  }

  /** Split exactly like firmware bleSendLine: chunks of MTU-3 bytes. */
  private sendLine(id: string, line: string): void {
    const c = this.connected.get(id);
    if (!c) {
      return;
    }
    const bytes = encodeUtf8(`${line}\n`);
    const chunk = c.mtu > 23 ? c.mtu - 3 : 20;
    for (let i = 0; i < bytes.length; i += chunk) {
      const part = bytes.slice(i, i + chunk);
      this.notifyCbs.forEach(cb => cb(id, part));
    }
  }
}
