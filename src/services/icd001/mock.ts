/**
 * Simulator for ICD-001 / H1.1 so the advanced-control UI can be built and
 * screenshotted without hardware. Emulates the firmware text protocol: INFO
 * characteristic, commands, OK/ERR replies, EVT lines, and TLM JSON pushed at
 * RATE Hz and chunked to MTU-3 bytes (exercising app-side line reassembly).
 *
 * Variants (PROTOCOL-ICD001.md, §7 wins):
 *  - 'icd1' = v0 "ICD001-0" (ICD1-5A3C): locked INFO schema with proto/ch,
 *    VHZ, LPULSE, telemetry vhz/lp/ot/lb, INFO ch.ot/ch.lb thresholds (low
 *    battery clears after vbat > clear for holdS s), START key toggles E-stop, rx buffered until `\n`/`;` (100 ms
 *    idle flush, 256-byte overflow -> ERR OVERFLOW), actuator commands rejected
 *    with ERR ESTOP / ERR OVERTEMP / ERR LOWBAT (first only) and not stored.
 *  - 'h11'  = H11 v1.0 h11-demo-ble as on H11-91B1: INFO without proto,
 *    `VCM on halfMs`, telemetry vcm:[on,halfMs], 3 PPG, each write executed
 *    as-is, VHZ/LPULSE -> ERR UNKNOWN, no ot/lb.
 */
import { clamp } from './protocol';
import { decodeUtf8, encodeUtf8 } from './utf8';

import type { ConnectResult, DiscoveredDevice, Icd001Transport } from './transport';

export type MockVariant = 'icd1' | 'h11';

export interface MockDeviceSnapshot {
  lra: [number, number];
  lp: [[number, number], [number, number]];
  freq: number;
  vcmOn: boolean;
  vcmHz: number;
  estop: boolean;
  ot: boolean;
  lowbat: boolean;
  ntc: number;
  vbat: number;
  rate: number;
}

const ACTUATOR_CMDS = new Set(['LRA', 'LPULSE', 'VHZ', 'VCM', 'AUTO', 'TEST']);

export class MockIcd001Device {
  lra: [number, number] = [0, 0];
  lp: [[number, number], [number, number]] = [
    [0, 0],
    [0, 0],
  ];
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
  /** Force temperature (UI testing of the over-temp lock). null = simulate. */
  ntcOverride: number | null = null;
  /** Force battery voltage (UI testing of the low-battery lock). null = simulate. */
  vbatOverride: number | null = null;
  readonly startedAt: number;
  commandLog: string[] = [];
  /** Safety thresholds (v0 reports them in INFO ch.ot / ch.lb, §8.4). */
  safety = { ot: { trip: 42, clear: 39 }, lb: { trip: 3.4, clear: 3.7, holdS: 60 } };
  /** Seconds vbat has stayed above lb.clear while latched (§8.2). */
  private lbAboveS = 0;

  constructor(
    readonly variant: MockVariant,
    readonly name: string,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.startedAt = now();
  }

  get isV0(): boolean {
    return this.variant === 'icd1';
  }

  get vhzRange(): { min: number; max: number } {
    return this.isV0 ? { min: 2, max: 50 } : { min: 2, max: 20 };
  }

  infoJson(): string {
    if (!this.isV0) {
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
    // §7.2 locked schema
    return JSON.stringify({
      proto: 'ICD001-0',
      prod: 'ICD-001',
      hw: 'H1.1',
      fw: 'icd001-sim',
      mux: 1,
      adsA: 1,
      adsB: 1,
      imu: 1,
      ppg: [1, 1, 1, 1],
      ch: {
        lra: { A: '上翼', B: '下翼' },
        freq: { min: 100, max: 300, def: 170 },
        vhz: { min: 2, max: 50, def: 10 },
        lpulse: { min: 50, max: 2000 },
        ppg: ['J13', 'J22', 'J23', 'EGG'],
        egg: { ppg: 3, act: 0 },
        ot: { ...this.safety.ot },
        lb: { ...this.safety.lb },
      },
    });
  }

  private allStop(): void {
    this.lra = [0, 0];
    this.lp = [
      [0, 0],
      [0, 0],
    ];
    this.vcmOn = false;
    this.auto = false;
  }

  /** v0 rejection (§7.5): first of ESTOP > OVERTEMP > LOWBAT. */
  private rejection(): string | null {
    if (!this.isV0) {
      return null; // H11 v1.0 accepts; outputs gated internally
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

  /** Execute a chunk of text the way the firmware splits it (`\n` / `;`). */
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

  /** Parse LRA/LPULSE target; returns group indexes or null. */
  private targets(t: string | undefined): number[] | null {
    if (t === '0' || (this.isV0 && t === 'A') || (!this.isV0 && t === 'CORE')) {
      return [0];
    }
    if (t === '1' || (this.isV0 && t === 'B') || (!this.isV0 && t === 'WING')) {
      return [1];
    }
    if (t === 'BOTH' || (this.isV0 && t === 'ALL') || (!this.isV0 && t === 'B')) {
      return [0, 1];
    }
    return null;
  }

  private handleCmd(c: string): string[] {
    const p = c.toUpperCase().split(/\s+/);
    const op = p[0];
    const a1 = p[1];
    const n = (i: number) => (p[i] !== undefined ? parseInt(p[i], 10) : NaN);
    const v1 = n(1);
    const v2 = n(2);
    if (!this.isV0 && (op === 'VHZ' || op === 'LPULSE')) {
      return [`ERR UNKNOWN ${op}`];
    }
    if (ACTUATOR_CMDS.has(op)) {
      const rej = this.rejection();
      if (rej) {
        return [rej]; // value NOT stored
      }
    }
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
      case 'TEST':
        this.allStop();
        return ['OK TEST'];
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
        return [`OK FREQ ${this.freq}`]; // §10.5: OK FREQ <f>
      case 'LRA': {
        if (Number.isNaN(v2) || v2 < 0 || v2 > 100) {
          return ['ERR LRA <0|1|B> <0-100>'];
        }
        const g = this.targets(a1);
        if (!g) {
          return ['ERR LRA target'];
        }
        this.auto = false;
        g.forEach(i => {
          this.lra[i] = v2;
          this.lp[i] = [0, 0]; // LRA cancels rhythm on that group
        });
        return [`OK LRA ${this.lra[0]} ${this.lra[1]}`]; // §10.5: both groups' current values
      }
      case 'LPULSE': {
        const on = n(3);
        const off = n(4);
        const g = this.targets(a1);
        const bad = (x: number) => Number.isNaN(x) || x < 50 || x > 2000;
        if (!g || Number.isNaN(v2) || v2 < 0 || v2 > 100 || bad(on) || bad(off)) {
          return ['ERR LPULSE <0|1|A|B|ALL> <0-100> <50-2000> <50-2000>'];
        }
        this.auto = false;
        g.forEach(i => {
          this.lra[i] = v2;
          this.lp[i] = [on, off];
        });
        return [`OK LPULSE ${a1} ${v2} ${on} ${off}`];
      }
      case 'VCM': {
        if (Number.isNaN(v1)) {
          return ['ERR VCM 0|1 [halfMs 25-250]'];
        }
        this.auto = false;
        this.vcmOn = v1 !== 0;
        if (!Number.isNaN(v2)) {
          this.vcmHz = 500 / clamp(v2, 25, 250);
        }
        return [`OK VCM ${this.vcmOn ? 1 : 0} ${Math.round(500 / this.vcmHz)}`];
      }
      case 'VHZ': {
        const { min, max } = this.vhzRange;
        if (Number.isNaN(v1) || (v1 !== 0 && (v1 < min || v1 > max))) {
          return [`ERR VHZ 0|${min}-${max}`];
        }
        this.auto = false;
        this.vcmOn = v1 !== 0;
        if (v1 !== 0) {
          this.vcmHz = v1;
        }
        return [`OK VHZ ${this.vcmOn ? this.vcmHz : 0}`]; // §10.5: OK VHZ <hz>
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
    if (this.vbatOverride !== null) {
      this.vbat = this.vbatOverride;
    } else {
      this.vbat = Math.max(3.3, this.vbat - dtS * (0.00005 + 0.0002 * drive));
    }
    if (this.isV0) {
      const { ot, lb } = this.safety;
      if (!this.ot && this.ntc >= ot.trip) {
        this.ot = true;
        this.allStop();
        evts.push('EVT OVERTEMP 1');
      } else if (this.ot && this.ntc < ot.clear) {
        this.ot = false;
        evts.push('EVT OVERTEMP 0');
      }
      if (!this.lowbat && this.vbat < lb.trip) {
        this.lowbat = true;
        this.lbAboveS = 0;
        this.allStop();
        evts.push('EVT LOWBAT 1');
      } else if (this.lowbat) {
        // §8.2: release only after vbat > clear held for holdS seconds
        this.lbAboveS = this.vbat > lb.clear ? this.lbAboveS + dtS : 0;
        if (this.lbAboveS >= lb.holdS) {
          this.lowbat = false;
          this.lbAboveS = 0;
          evts.push('EVT LOWBAT 0');
        }
      }
    }
    return evts;
  }

  /** Emulates the START key on the device body: toggles E-stop, emits EVT ESTOP n (§8.3). */
  pressStartKey(): string {
    this.estop = !this.estop;
    if (this.estop) {
      this.allStop();
    }
    return `EVT ESTOP ${this.estop ? 1 : 0}`;
  }

  tlmJson(): string {
    const t = this.now() - this.startedAt;
    const nPpg = this.isV0 ? 4 : 3;
    const warm = t > 3000;
    const ppg = Array.from({ length: nPpg }, (_, i) => [
      52000 + i * 1500 + Math.round(Math.sin(t / 160 + i) * 800),
      1,
      warm ? 70 + ((i * 3 + Math.floor(t / 4000)) % 6) : 0,
    ]);
    const vcmOut = this.vcmOn && !this.estop;
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
    };
    if (this.isV0) {
      obj.lp = this.lp;
      obj.vhz = vcmOut ? Math.round(this.vcmHz) : 0;
    } else {
      obj.vcm = [vcmOut ? 1 : 0, Math.round(500 / this.vcmHz)];
    }
    obj.auto = this.auto ? 1 : 0;
    obj.estop = this.estop ? 1 : 0;
    if (this.isV0) {
      obj.ot = this.ot ? 1 : 0;
      obj.lb = this.lowbat ? 1 : 0;
    }
    return JSON.stringify(obj);
  }

  snapshot(): MockDeviceSnapshot {
    return {
      lra: [this.lra[0], this.lra[1]],
      lp: [
        [this.lp[0][0], this.lp[0][1]],
        [this.lp[1][0], this.lp[1][1]],
      ],
      freq: this.freq,
      vcmOn: this.vcmOn,
      vcmHz: this.vcmHz,
      estop: this.estop,
      ot: this.ot,
      lowbat: this.lowbat,
      ntc: this.ntc,
      vbat: this.vbat,
      rate: this.rate,
    };
  }
}

type Timer = ReturnType<typeof setInterval>;

interface Conn {
  mtu: number;
  timer: Timer;
  lastStep: number;
  lastTlm: number;
  /** v0 receive buffer (executes on `\n`/`;`, or after 100 ms idle). */
  rx: string;
  rxIdle: ReturnType<typeof setTimeout> | null;
}

/** In-memory transport backed by MockIcd001Device instances. */
export class MockIcd001Transport implements Icd001Transport {
  readonly kind = 'mock' as const;
  readonly devices: Map<string, MockIcd001Device>;
  private notifyCbs = new Set<(id: string, bytes: number[]) => void>();
  private discCbs = new Set<(id: string) => void>();
  private connected = new Map<string, Conn>();

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
      const delay = 150 + i * 200;
      const rssi = -48 - i * 9;
      i++;
      // Like a real active scan: adv packet (UUID only) first, then the scan
      // response with the name.
      setTimeout(() => onDevice({ id, name: null, rssi, kind: null, simulated: true }), delay);
      setTimeout(() => onDevice({ id, name: d.name, rssi, kind, simulated: true }), delay + 50);
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
    const c: Conn = { mtu, lastStep: now, lastTlm: now, timer: 0 as unknown as Timer, rx: '', rxIdle: null };
    c.timer = setInterval(() => this.tick(id), 25);
    this.connected.set(id, c);
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
    if (c.rxIdle) {
      clearTimeout(c.rxIdle);
    }
    this.connected.delete(id);
    this.devices.get(id)?.handleWrite('STOP'); // firmware: BLE disconnect -> stop all
    if (notify) {
      this.discCbs.forEach(cb => cb(id));
    }
  }

  async readInfo(id: string): Promise<number[]> {
    const dev = this.requireConnected(id);
    return encodeUtf8(dev.infoJson());
  }

  async write(id: string, bytes: number[], _withResponse: boolean, allowSplit: boolean): Promise<void> {
    const dev = this.requireConnected(id);
    const c = this.connected.get(id) as Conn;
    const max = c.mtu - 3;
    if (bytes.length > max && !allowSplit) {
      throw new Error('write exceeds MTU');
    }
    // Deliver as ATT-sized packets, like the BLE stack would.
    for (let i = 0; i < bytes.length; i += max) {
      this.receive(id, dev, c, decodeUtf8(bytes.slice(i, i + max)));
    }
  }

  private receive(id: string, dev: MockIcd001Device, c: Conn, text: string): void {
    const reply = (lines: string[]) => setTimeout(() => lines.forEach(r => this.sendLine(id, r)), 5);
    if (!dev.isV0) {
      reply(dev.handleWrite(text)); // H11 v1.0: each write executed as-is
      return;
    }
    c.rx += text;
    if (c.rx.length > 256) {
      c.rx = '';
      reply(['ERR OVERFLOW']);
      return;
    }
    const lastSep = Math.max(c.rx.lastIndexOf('\n'), c.rx.lastIndexOf(';'));
    if (lastSep >= 0) {
      const ready = c.rx.slice(0, lastSep + 1);
      c.rx = c.rx.slice(lastSep + 1);
      reply(dev.handleWrite(ready));
    }
    if (c.rxIdle) {
      clearTimeout(c.rxIdle);
      c.rxIdle = null;
    }
    if (c.rx.length) {
      c.rxIdle = setTimeout(() => {
        c.rxIdle = null;
        const rest = c.rx;
        c.rx = '';
        reply(dev.handleWrite(rest));
      }, 100);
    }
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
