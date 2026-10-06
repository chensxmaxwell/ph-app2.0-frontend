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
 *  - 'icd1v1' = "ICD001-1" (h11-icd-v1 1.1.0) auto / manual, §11.4–§11.6:
 *    boots in AUTO (lastReason BOOT); MODE / MODE query / AUTO alias, idempotent;
 *    actuator commands in auto -> `ERR MODE AUTO <verb>`; verb-tagged ERRs;
 *    STOP / ESTOP 1 / START key / OT / LB -> manual + `EVT MODE MANUAL <reason>`;
 *    ESTOP 0 stays manual; BLE drop: manual -> zero + back to auto (not while
 *    latched); HB timeout in manual -> zero + `EVT MODE AUTO HOST_TIMEOUT`;
 *    PZERO in auto -> `OK PZERO` then `EVT PZERO`; TLM carries mode + src.
 */
import { clamp } from './protocol';
import { decodeUtf8, encodeUtf8 } from './utf8';

import type { ConnectResult, DiscoveredDevice, Icd001Transport } from './transport';

export type MockVariant = 'icd1' | 'icd1v1' | 'h11';

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
/** §11.4.9: refused in auto (AUTO is the MODE alias on ICD001-1). */
const V1_ACTUATOR_CMDS = new Set(['LRA', 'LPULSE', 'VHZ', 'VCM', 'TEST']);

export type MockMode = 'auto' | 'manual';

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
  // ---- ICD001-1 (§11.4–§11.6)
  /** §11.5.1: boots in auto. */
  mode: MockMode = 'auto';
  modeReason = 'BOOT';
  /** HB seconds for this connection (0 = off, §11.4.12). */
  hb = 0;
  lastHostAt = 0;
  /** Sensor status override for UI testing (§11.4.4); null = all usable. */
  srcOverride: { fsr: number[]; ppg: number[] } | null = null;
  /** Pressure baseline reset time (PZERO / PAUSE key). */
  private pzeroAt = 0;
  private pendingEvts: Array<{ at: number; line: string }> = [];
  autoCaps = { hbMaxS: 30, lraSrc: { A: 0, B: 2 }, vhz: { min: 5, max: 10 } };

  constructor(
    readonly variant: MockVariant,
    readonly name: string,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.startedAt = now();
  }

  /** Line-buffered v0+ firmware (ICD001-0 and ICD001-1). */
  get isV0(): boolean {
    return this.variant === 'icd1' || this.variant === 'icd1v1';
  }

  /** ICD001-1: auto / manual modes. */
  get isV1(): boolean {
    return this.variant === 'icd1v1';
  }

  get latch(): 'ESTOP' | 'OVERTEMP' | 'LOWBAT' | null {
    return this.estop ? 'ESTOP' : this.ot ? 'OVERTEMP' : this.lowbat ? 'LOWBAT' : null;
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
    // §7.2 locked schema (+ §11 / §11.4.7 / §11.5.1 on ICD001-1)
    const v1 = this.isV1
      ? {
          mode: ['manual', 'auto'],
          boot: 'auto',
          auto: {
            vhz: { ...this.autoCaps.vhz },
            press: { on: 80, off: 50, full: 1200 },
            hr: { lo: 60, hi: 120 },
            lraNoHr: 25,
            fsr: ['J19', 'J20'],
            lraSrc: { ...this.autoCaps.lraSrc },
            hbMaxS: this.autoCaps.hbMaxS,
            maxMin: 0,
          },
        }
      : {};
    return JSON.stringify({
      proto: this.isV1 ? 'ICD001-1' : 'ICD001-0',
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
        ...v1,
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

  /** ICD001-1 real mode switch: zero all outputs first (§11.3.2), then EVT (§11.4.6). */
  private switchMode(m: MockMode, reason: string): string {
    this.allStop();
    this.mode = m;
    this.modeReason = reason;
    return `EVT MODE ${m.toUpperCase()} ${reason}`;
  }

  /** Called by the transport on BLE drop (§11.5.2, §11.6.2). */
  onDisconnect(): void {
    if (!this.isV1) {
      this.handleWrite('STOP'); // firmware: BLE disconnect -> stop all
      return;
    }
    this.hb = 0; // §11.4.12: HB is per connection
    if (this.latch) {
      this.allStop(); // §11.6.2: stays manual + latched, outputs 0
      return;
    }
    if (this.mode === 'manual') {
      this.switchMode('auto', 'BLE_DISCONNECT'); // serial log only
    }
  }

  /** ICD001-1 commands (§11.4); null = fall through to the shared v0 handling. */
  private handleV1(op: string, p: string[]): string[] | null {
    const a1 = p[1];
    const v1 = a1 !== undefined ? parseInt(a1, 10) : NaN;
    if (op === 'MODE' || op === 'AUTO') {
      let target: MockMode | null;
      if (op === 'MODE') {
        if (a1 === undefined) {
          return [`OK MODE ${this.mode.toUpperCase()} ${this.modeReason}`]; // §11.4.2
        }
        target = a1 === 'AUTO' ? 'auto' : a1 === 'MANUAL' ? 'manual' : null;
      } else {
        target = Number.isNaN(v1) ? null : v1 !== 0 ? 'auto' : 'manual'; // §11.4.3 alias
      }
      if (!target) {
        return [`ERR ARG ${op}`];
      }
      if (target === 'auto' && this.latch) {
        return [`ERR ${this.latch} ${op}`]; // §11.4.10
      }
      if (target === this.mode) {
        return [`OK MODE ${target.toUpperCase()}`]; // §11.4.1 idempotent: no zeroing, no EVT
      }
      return [`OK MODE ${target.toUpperCase()}`, this.switchMode(target, 'CMD')];
    }
    if (op === 'HB') {
      if (Number.isNaN(v1) || (v1 !== 0 && (v1 < 5 || v1 > this.autoCaps.hbMaxS))) {
        return ['ERR RANGE HB'];
      }
      this.hb = v1;
      return [`OK HB ${v1}`];
    }
    if (op === 'PZERO') {
      if (this.mode !== 'auto') {
        return ['ERR MODE MANUAL PZERO'];
      }
      this.pzeroAt = this.now();
      this.pendingEvts.push({ at: this.now() + 300, line: 'EVT PZERO' });
      return ['OK PZERO'];
    }
    if (V1_ACTUATOR_CMDS.has(op)) {
      if (this.latch) {
        return [`ERR ${this.latch} ${op}`]; // §11.4.5
      }
      if (this.mode === 'auto') {
        return [`ERR MODE AUTO ${op}`]; // §11.4.9: no implicit exit
      }
      return null;
    }
    if (op === 'STOP') {
      this.allStop();
      return this.mode === 'auto' ? ['OK STOP', this.switchMode('manual', 'STOP')] : ['OK STOP'];
    }
    if (op === 'ESTOP') {
      const on = a1 === undefined ? true : v1 !== 0;
      this.estop = on;
      if (!on) {
        return ['OK ESTOP 0']; // §11.6.4: stays manual, outputs 0
      }
      this.allStop();
      // §11.4.6: OK ESTOP 1 -> EVT MODE MANUAL ESTOP (still no EVT ESTOP, §9.1)
      return this.mode === 'auto' ? ['OK ESTOP 1', this.switchMode('manual', 'ESTOP')] : ['OK ESTOP 1'];
    }
    return null;
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
        this.lastHostAt = this.now(); // §11.4.12: any host command is a heartbeat
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
    if (this.isV1) {
      const r = this.handleV1(op, p);
      if (r) {
        return r;
      }
    } else if (op === 'MODE' || op === 'HB' || op === 'PZERO') {
      return [`ERR UNKNOWN ${op}`]; // not in ICD001-0 / H11 v1.0
    }
    if (!this.isV1 && ACTUATOR_CMDS.has(op)) {
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
        if (this.isV1 && this.mode === 'auto') {
          evts.push(this.switchMode('manual', 'OVERTEMP')); // latch event first (§11.4.6)
        }
      } else if (this.ot && this.ntc < ot.clear) {
        this.ot = false;
        evts.push('EVT OVERTEMP 0');
      }
      if (!this.lowbat && this.vbat < lb.trip) {
        this.lowbat = true;
        this.lbAboveS = 0;
        this.allStop();
        evts.push('EVT LOWBAT 1');
        if (this.isV1 && this.mode === 'auto') {
          evts.push(this.switchMode('manual', 'LOWBAT'));
        }
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
    if (this.isV1) {
      const now = this.now();
      // §11.5.3 / §11.4.12: HB timeout. Manual -> zero + back to auto; auto: ignored.
      // While latched the device stays manual (treated like a BLE drop, §11.6.2; asked hardware).
      if (this.hb > 0 && now - this.lastHostAt > this.hb * 1000) {
        this.lastHostAt = now;
        if (this.mode === 'manual' && !this.latch) {
          evts.push(this.switchMode('auto', 'HOST_TIMEOUT'));
        }
      }
      const due = this.pendingEvts.filter(e => e.at <= now);
      this.pendingEvts = this.pendingEvts.filter(e => e.at > now);
      due.forEach(e => evts.push(e.line));
    }
    return evts;
  }

  /**
   * Emulates the START key on the device body (phone connected): toggles
   * E-stop, `EVT ESTOP n` (§8.3); on ICD001-1 engaging in auto adds
   * `EVT MODE MANUAL KEY` (§11.4.6); releasing stays manual (§11.6.4).
   */
  pressStartKey(): string[] {
    this.estop = !this.estop;
    if (this.estop) {
      this.allStop();
    }
    const out = [`EVT ESTOP ${this.estop ? 1 : 0}`];
    if (this.isV1 && this.estop && this.mode === 'auto') {
      out.push(this.switchMode('manual', 'KEY'));
    }
    return out;
  }

  /** Emulates the PAUSE key (§11.3.9): re-zero pressure in auto, nothing in manual. */
  pressPauseKey(): string[] {
    if (!this.isV1 || this.mode !== 'auto') {
      return [];
    }
    this.pzeroAt = this.now();
    return ['EVT PZERO'];
  }

  /** Sensor status (§11.4.4): 1 usable, 0 failed / not fitted. */
  srcStatus(): { fsr: number[]; ppg: number[] } {
    return this.srcOverride ?? { fsr: [1, 1], ppg: [1, 1, 1, 1] };
  }

  /** Simulated pressure delta (mV) above the PZERO baseline: slow squeeze waves. */
  pressureMv(): number {
    const t = this.now() - this.pzeroAt;
    return Math.max(0, Math.round(900 * Math.sin((2 * Math.PI * t) / 7000)));
  }

  /** Auto outputs per §11.2 (actual values, as reported in TLM, §11.4.8). */
  autoOutputs(ppg: number[][]): { lra: [number, number]; vhz: number } {
    if (this.latch) {
      return { lra: [0, 0], vhz: 0 };
    }
    const src = this.srcStatus();
    const wing = (idx: number) => {
      const r = ppg[idx];
      if (!r || !src.ppg[idx] || !r[1]) {
        return 0;
      }
      const hr = r[2];
      if (!hr) {
        return 25;
      }
      return Math.round(40 + (clamp(hr, 60, 120) - 60) * (60 / 60));
    };
    const fsrOk = src.fsr.some(x => x);
    const p = fsrOk ? this.pressureMv() : 0;
    const { min, max } = this.autoCaps.vhz;
    const vhz = p >= 80 ? Math.round(min + (max - min) * clamp((p - 80) / (1200 - 80), 0, 1)) : 0;
    return { lra: [wing(this.autoCaps.lraSrc.A), wing(this.autoCaps.lraSrc.B)], vhz };
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
    const auto = this.isV1 && this.mode === 'auto' ? this.autoOutputs(ppg) : null;
    const obj: Record<string, unknown> = {
      t,
      ppg,
      fsr: [0, 0, 0, 0, 0],
      hall: 0,
      ntc: Math.round(this.ntc * 10) / 10,
      vbat: Math.round(this.vbat * 100) / 100,
      acc: [0.01, -0.02, 1.0],
      gyr: [0, 0, 0],
      lra: auto ? auto.lra : [this.lra[0], this.lra[1]],
      f: this.freq,
    };
    if (this.isV0) {
      obj.lp = auto
        ? [
            [0, 0],
            [0, 0],
          ]
        : this.lp;
      obj.vhz = auto ? auto.vhz : vcmOut ? Math.round(this.vcmHz) : 0;
    } else {
      obj.vcm = [vcmOut ? 1 : 0, Math.round(500 / this.vcmHz)];
    }
    obj.auto = this.auto ? 1 : 0;
    obj.estop = this.estop ? 1 : 0;
    if (this.isV0) {
      obj.ot = this.ot ? 1 : 0;
      obj.lb = this.lowbat ? 1 : 0;
    }
    if (this.isV1) {
      obj.mode = this.mode; // §11.4.4: every frame, both modes
      obj.src = this.srcStatus();
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
      new MockIcd001Device('icd1v1', 'ICD1-7E21'),
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
    this.devices.get(id)?.onDisconnect(); // firmware: v0 stops all; ICD001-1 §11.5.2 / §11.6.2
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
      dev.pressStartKey().forEach(l => this.sendLine(id, l));
    }
  }

  /** Emulate the device PAUSE key (ICD001-1 auto: re-zero pressure). */
  pressPauseKey(id: string): void {
    const dev = this.devices.get(id);
    if (dev && this.connected.has(id)) {
      dev.pressPauseKey().forEach(l => this.sendLine(id, l));
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
