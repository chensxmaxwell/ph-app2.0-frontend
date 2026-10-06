/**
 * ICD001-1 auto / manual (PROTOCOL-ICD001 §11.4, §11.5 boot-in-auto, §11.6
 * takeover boundaries): protocol parsing, client commands, simulator
 * semantics, view-model notices and the races. One `it` per rule; the §
 * number is in each title.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  AdvancedControlController,
  IntensityView,
  RhythmView,
  SensorView,
} from '../../src/screens/advanced-control/controller';
import {
  AUTO_HINT_TOAST,
  autoPillVisible,
  autoSensors,
  modeNoticeFor,
} from '../../src/screens/advanced-control/model';
import { resetPulseSpeedCache } from '../../src/screens/advanced-control/pulseMemory';
import { APP_HB_S, Icd001Client, MANUAL_LEAVE_ACTION, effectiveMode } from '../../src/services/icd001/client';
import { MockIcd001Device, MockIcd001Transport, MockVariant } from '../../src/services/icd001/mock';
import {
  formatHb,
  formatMode,
  formatPzero,
  parseErr,
  parseInfo,
  parseLine,
  parseModeEvt,
  parseOkReply,
  parseTelemetry,
  supportsAuto,
} from '../../src/services/icd001/protocol';

const tick = async (ms: number) => {
  for (let i = 0; i < ms; i += 10) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

const V1_INFO = {
  proto: 'ICD001-1',
  prod: 'ICD-001',
  hw: 'H1.1',
  fw: 'h11-icd-v1 1.1.0',
  ppg: [1, 1, 1, 1],
  ch: {
    lra: { A: '上翼', B: '下翼' },
    freq: { min: 100, max: 300, def: 170 },
    vhz: { min: 2, max: 50, def: 10 },
    lpulse: { min: 50, max: 2000 },
    ppg: ['J13', 'J22', 'J23', 'EGG'],
    egg: { ppg: 3, act: 0 },
    mode: ['manual', 'auto'],
    boot: 'auto',
    auto: {
      vhz: { min: 5, max: 10 },
      press: { on: 80, off: 50, full: 1200 },
      hr: { lo: 60, hi: 120 },
      lraNoHr: 25,
      fsr: ['J19', 'J20'],
      lraSrc: { A: 0, B: 2 },
      hbMaxS: 30,
      maxMin: 0,
    },
  },
};

describe('§11.4 protocol parsing / formatting', () => {
  it('§11.4.7 / §11.5.1 INFO ch.mode, ch.boot, ch.auto; §11.4.16 Auto only on ICD001-1 with "auto"', () => {
    const i = parseInfo(V1_INFO)!;
    expect(i.auto).toEqual({
      modes: ['manual', 'auto'],
      boot: 'auto',
      vhz: { min: 5, max: 10 },
      press: { on: 80, off: 50, full: 1200 },
      hr: { lo: 60, hi: 120 },
      lraNoHr: 25,
      fsr: ['J19', 'J20'],
      lraSrc: { A: 0, B: 2 },
      hbMaxS: 30,
      maxMin: 0,
    });
    expect(supportsAuto(i)).toBe(true);
    // ICD001-0, H11 legacy, ICD001-1 without "auto" in ch.mode: no Auto
    expect(supportsAuto(parseInfo({ ...V1_INFO, proto: 'ICD001-0' }))).toBe(false);
    expect(supportsAuto(parseInfo({ fw: 'h11-demo-ble', ppg: [1, 1, 1] }))).toBe(false);
    expect(supportsAuto(parseInfo({ ...V1_INFO, ch: { ...V1_INFO.ch, mode: ['manual'] } }))).toBe(false);
    expect(parseInfo({ ...V1_INFO, ch: { ...V1_INFO.ch, mode: undefined } })!.auto).toBeNull();
    // §11.5.6 maxMin fixed 0; a future >0 is parsed (never shown)
    const m = parseInfo({ ...V1_INFO, ch: { ...V1_INFO.ch, auto: { ...V1_INFO.ch.auto, maxMin: 45 } } })!;
    expect(m.auto!.maxMin).toBe(45);
    // tolerant: missing auto params -> fallbacks
    const bare = parseInfo({ ...V1_INFO, ch: { ...V1_INFO.ch, auto: undefined } })!;
    expect(bare.auto).toMatchObject({
      vhz: { min: 5, max: 10 },
      lraSrc: { A: 0, B: 2 },
      hbMaxS: 30,
      maxMin: 0,
    });
  });

  it('§11.4.4 / §11.4.8 TLM mode + src (both modes); older frames: null', () => {
    const t = parseTelemetry({
      t: 1,
      lra: [62, 0],
      vhz: 7,
      mode: 'auto',
      src: { fsr: [1, 1], ppg: [1, 0, 1, 1] },
    });
    expect(t.mode).toBe('auto');
    expect(t.src).toEqual({ fsr: [true, true], ppg: [true, false, true, true] });
    expect(t.vcm).toEqual({ on: true, hz: 7 }); // actual auto output 5–10 Hz
    expect(parseTelemetry({ t: 1, lra: [0, 0], vhz: 0, mode: 'MANUAL' }).mode).toBe('manual');
    const v0 = parseTelemetry({ t: 1, lra: [0, 0], vhz: 0 });
    expect(v0.mode).toBeNull();
    expect(v0.src).toBeNull();
  });

  it('§11.4.2 OK MODE <x> [lastReason]; §11.4.12 OK HB s; §11.4.14 OK PZERO', () => {
    expect(parseOkReply(['MODE', 'AUTO'])).toEqual({ cmd: 'MODE', mode: 'auto', reason: null });
    expect(parseOkReply(['MODE', 'MANUAL', 'BLE_DISCONNECT'])).toEqual({
      cmd: 'MODE',
      mode: 'manual',
      reason: 'BLE_DISCONNECT',
    });
    expect(parseOkReply(['MODE', 'AUTO', 'BOOT'])).toMatchObject({ reason: 'BOOT' });
    expect(parseOkReply(['MODE', 'SIDEWAYS'])).toBeNull();
    expect(parseOkReply(['HB', '10'])).toEqual({ cmd: 'HB', s: 10 });
    expect(parseOkReply(['PZERO'])).toEqual({ cmd: 'PZERO' });
  });

  it('§11.4.5 ERR <reason> <verb>; old firmware without the verb still parses', () => {
    expect(parseErr(['MODE', 'AUTO', 'LRA'])).toEqual({ reason: 'MODE AUTO', verb: 'LRA' });
    expect(parseErr(['MODE', 'MANUAL', 'PZERO'])).toEqual({ reason: 'MODE MANUAL', verb: 'PZERO' });
    expect(parseErr(['ESTOP', 'MODE'])).toEqual({ reason: 'ESTOP', verb: 'MODE' });
    expect(parseErr(['OVERTEMP', 'VHZ'])).toEqual({ reason: 'OVERTEMP', verb: 'VHZ' });
    expect(parseErr(['RANGE', 'HB'])).toEqual({ reason: 'RANGE', verb: 'HB' });
    expect(parseErr(['MODE', 'AUTO'])).toEqual({ reason: 'MODE AUTO', verb: null }); // not "AUTO" alias
    expect(parseErr(['ESTOP'])).toEqual({ reason: 'ESTOP', verb: null });
    // safety classification unchanged by the extra word
    expect(parseLine('ERR ESTOP MODE')).toMatchObject({ kind: 'err', args: ['ESTOP', 'MODE'] });
  });

  it('§11.4.6 EVT MODE reasons (exhaustive list) + tolerant unknown reason', () => {
    for (const r of [
      'CMD',
      'STOP',
      'ESTOP',
      'KEY',
      'OVERTEMP',
      'LOWBAT',
      'HOST_TIMEOUT',
      'BLE_DISCONNECT',
      'BOOT',
    ]) {
      expect(parseModeEvt(['MANUAL', r])).toEqual({ mode: 'manual', reason: r });
    }
    expect(parseModeEvt(['AUTO', 'timeout'])).toEqual({ mode: 'auto', reason: 'TIMEOUT' });
    expect(parseModeEvt(['AUTO'])).toEqual({ mode: 'auto', reason: null });
    expect(parseModeEvt(['FOO', 'CMD'])).toBeNull();
  });

  it('commands: MODE / MODE AUTO / MODE MANUAL / HB (0 or 5–hbMaxS) / PZERO', () => {
    expect(formatMode()).toBe('MODE');
    expect(formatMode('auto')).toBe('MODE AUTO');
    expect(formatMode('manual')).toBe('MODE MANUAL');
    expect(formatHb(10)).toBe('HB 10');
    expect(formatHb(0)).toBe('HB 0');
    expect(formatHb(2)).toBe('HB 5');
    expect(formatHb(99, 30)).toBe('HB 30');
    expect(formatPzero()).toBe('PZERO');
  });

  it('notice mapping: which mode changes notice (CMD / BOOT / TIMEOUT never)', () => {
    expect(modeNoticeFor('auto', 'manual', 'OVERTEMP')).toBe('OVERTEMP');
    expect(modeNoticeFor('auto', 'manual', 'KEY')).toBe('KEY');
    expect(modeNoticeFor('manual', 'auto', 'HOST_TIMEOUT')).toBe('HOST_TIMEOUT');
    expect(modeNoticeFor('manual', 'auto', 'BLE_DISCONNECT')).toBe('BLE_DISCONNECT');
    expect(modeNoticeFor('auto', 'manual', 'CMD')).toBeNull();
    expect(modeNoticeFor('manual', 'manual', 'STOP')).toBeNull();
    expect(modeNoticeFor('auto', 'manual', 'TIMEOUT')).toBeNull(); // §11.5.6: no auto-timeout UI
    expect(modeNoticeFor(null, 'auto', 'BOOT')).toBeNull();
  });
});

// ------------------------------------------------------------ simulator + client + view-model

async function setup(variant: MockVariant = 'icd1v1', pre?: (dev: MockIcd001Device) => void) {
  const dev = new MockIcd001Device(variant, variant === 'h11' ? 'H11-91B1' : 'ICD1-AUTO');
  dev.ntcOverride = 34.2;
  dev.vbatOverride = 3.95;
  pre?.(dev);
  const transport = new MockIcd001Transport([dev], { mtu: 185, connectDelayMs: 10 });
  const client = new Icd001Client(transport, { reconnectDelaysMs: [100, 100] });
  const ctl = new AdvancedControlController(client);
  ctl.start();
  const id = `sim-${dev.name}`;
  const device = { id, name: dev.name, rssi: -50, kind: null, simulated: true };
  const p = client.connect(device);
  await tick(400);
  expect(await p).toBe(true);
  const v = () => ctl.getView();
  const wing = () => v().cards.find(c => c.kind === 'intensity') as IntensityView;
  const pulse = () => v().cards.find(c => c.kind === 'rhythm') as RhythmView;
  const egg = () => v().cards.find(c => c.kind === 'sensor') as SensorView;
  const log = () => client.getState().log;
  /** Commands the device received from index `from` on. */
  const since = (from: number) => dev.commandLog.slice(from).filter(c => c !== 'PING');
  const banner = () => (v().banner ? [v().banner!.title, v().banner!.line] : null);
  const takeOver = async () => {
    ctl.setMode('manual');
    await tick(200);
    expect(effectiveMode(client.getState())).toBe('manual');
  };
  const done = () => {
    ctl.dispose();
    client.destroy();
  };
  return { dev, transport, client, ctl, id, device, v, wing, pulse, egg, log, since, banner, takeOver, done };
}

describe('ICD001-1 on the simulator (§11.4–§11.6)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 20_000_000 });
    resetPulseSpeedCache();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('§11.5.1 connect: RATE, HB 10, MODE query -> AUTO BOOT; read-only cards; app sends no MODE AUTO', async () => {
    const t = await setup();
    expect(t.dev.commandLog.slice(0, 3)).toEqual(['RATE 10', `HB ${APP_HB_S}`, 'MODE']);
    expect(t.dev.commandLog).not.toContain('MODE AUTO');
    const s = t.client.getState();
    expect(s).toMatchObject({
      autoSupported: true,
      mode: 'auto',
      modeReason: 'BOOT',
      hb: 10,
      modePending: null,
    });
    expect(t.v().mode).toMatchObject({
      supported: true,
      current: 'auto',
      switching: false,
      autoAllowed: true,
    });
    expect(t.wing().readOnly).toBe(true);
    expect(t.wing().enabled).toBe(false);
    expect(t.pulse()).toMatchObject({ readOnly: true, range: { min: 5, max: 10 } });
    expect(t.v().mode.pzero).toBe('available');
    expect(t.egg().sensors).toEqual({ pressure: 'ok', upper: 'ok', lower: 'ok', overall: 'ok' });
    expect(t.v().banner).toBeNull();
    t.done();
  });

  it('§11.4.8 auto cards show the actual TLM output (lra, vhz 5–10, 0 = not firing)', async () => {
    const t = await setup();
    await tick(4000); // HR warms up in the simulator
    const tlm = t.client.getState().tlm!;
    expect(tlm.mode).toBe('auto');
    expect(t.wing().values).toEqual({ A: tlm.lra[0], B: tlm.lra[1] });
    expect(tlm.lra[0]).toBeGreaterThanOrEqual(40);
    const hz = tlm.vcm.on ? tlm.vcm.hz : 0;
    expect(t.pulse().on).toBe(hz! > 0);
    if (hz) {
      expect(hz).toBeGreaterThanOrEqual(5);
      expect(hz).toBeLessThanOrEqual(10);
      expect(t.pulse().hz).toBe(hz);
    }
    t.done();
  });

  it('§11.4.16 ICD001-0 and H11 v1.0: no HB / MODE sent, no Auto control, leave = STOP', async () => {
    for (const variant of ['icd1', 'h11'] as const) {
      const t = await setup(variant);
      expect(t.dev.commandLog).not.toContain('MODE');
      expect(t.dev.commandLog.some(c => c.startsWith('HB'))).toBe(false);
      expect(t.client.getState()).toMatchObject({ autoSupported: false, mode: null });
      expect(t.v().mode).toMatchObject({ supported: false, current: null, pzero: null });
      expect(t.wing().readOnly).toBe(false);
      expect(t.client.setMode('auto')).toBe(false);
      expect(t.client.pzero()).toBe(false);
      const n = t.dev.commandLog.length;
      t.ctl.leave();
      await tick(100);
      expect(t.since(n)).toEqual(['STOP']);
      t.done();
    }
  });

  it('§11.5.5 touching a read-only control in Auto: hint, no command, no takeover', async () => {
    const t = await setup();
    const n = t.dev.commandLog.length;
    t.ctl.setWingValue('A', 60);
    t.ctl.setPulseOn(true);
    t.ctl.setPulseHz(30);
    t.ctl.setWingOn(true);
    await tick(300);
    expect(t.since(n)).toEqual([]);
    expect(t.v().toast).toEqual(AUTO_HINT_TOAST);
    expect(t.client.getState().mode).toBe('auto');
    t.done();
  });

  it('§11.5.5 Manual = explicit takeover: MODE MANUAL, OK then EVT MODE MANUAL CMD, sliders unlock from 0', async () => {
    const t = await setup();
    const n = t.dev.commandLog.length;
    t.ctl.setMode('manual');
    expect(t.v().mode).toMatchObject({ current: 'manual', switching: true });
    await tick(200);
    expect(t.since(n)).toEqual(['MODE MANUAL']);
    const lines = t.log().filter(l => l.startsWith('<') && /MODE/.test(l));
    expect(lines.slice(-2)).toEqual(['< OK MODE MANUAL', '< EVT MODE MANUAL CMD']);
    expect(t.v().mode).toMatchObject({ current: 'manual', switching: false });
    expect(t.wing()).toMatchObject({ readOnly: false, enabled: true, values: { A: 0, B: 0 } });
    expect(t.v().banner).toBeNull(); // CMD: no notice
    expect(t.v().mode.pzero).toBeNull();
    expect(t.egg().sensors).toBeNull();
    t.ctl.setWingValue('A', 40);
    await tick(300);
    expect(t.dev.commandLog).toContain('LRA 0 40');
    expect(t.dev.snapshot().lra).toEqual([40, 0]);
    t.done();
  });

  it('§11.4.9 race: slider values not yet sent when MODE AUTO goes out are dropped; later input blocked', async () => {
    const t = await setup();
    await t.takeOver();
    t.ctl.setWingValue('A', 30);
    t.ctl.setWingValue('A', 31); // throttled: still pending in the scheduler
    t.ctl.setWingValue('B', 50); // pending
    t.ctl.setMode('auto'); // sendNow drops pending, MODE AUTO next
    t.ctl.setWingValue('A', 90); // blocked: pending auto counts as auto
    await tick(300);
    const after = t.dev.commandLog.filter(c => c !== 'PING');
    const iAuto = after.lastIndexOf('MODE AUTO');
    expect(iAuto).toBeGreaterThan(-1);
    expect(after.slice(iAuto + 1).filter(c => c.startsWith('LRA'))).toEqual([]);
    expect(after).not.toContain('LRA 0 90');
    expect(after).not.toContain('LRA 1 50');
    expect(t.client.getState().mode).toBe('auto');
    expect(t.v().toast).toEqual(AUTO_HINT_TOAST);
    t.done();
  });

  it('§11.4.9 race: an input already on the wire -> ERR MODE AUTO LRA is ignored silently (no toast, no revert)', async () => {
    const t = await setup();
    await t.takeOver();
    t.ctl.setWingValue('A', 30);
    await tick(150);
    t.ctl.setMode('auto');
    await tick(150);
    // a write that was already in the radio when MODE AUTO went out
    await (t.client as unknown as { write: (l: string, u: boolean) => Promise<void> }).write(
      'LRA 0 35',
      false,
    );
    await tick(100);
    expect(t.log()).toContain('< ERR MODE AUTO LRA');
    expect(t.client.getState().lastErrInfo).toMatchObject({ reason: 'MODE AUTO', verb: 'LRA' });
    expect(t.v().toast).toBeNull();
    expect(t.client.getState().mode).toBe('auto');
    t.done();
  });

  it('§11.4.1 MODE is idempotent: no zeroing, no EVT when already in that mode', async () => {
    const t = await setup();
    const evts = () => t.log().filter(l => l.startsWith('< EVT MODE')).length;
    const e0 = evts();
    t.client.setMode('auto');
    await tick(200);
    expect(t.log()).toContain('< OK MODE AUTO');
    expect(evts()).toBe(e0);
    await t.takeOver();
    t.ctl.setWingValue('B', 55);
    await tick(300);
    const e1 = evts();
    t.client.setMode('manual');
    await tick(200);
    expect(evts()).toBe(e1);
    expect(t.dev.snapshot().lra).toEqual([0, 55]); // not zeroed
    t.done();
  });

  it('§11.4.2 MODE reply lost -> re-query after 2 s; the UI follows the device', async () => {
    const t = await setup();
    const orig = t.dev.handleWrite.bind(t.dev);
    let swallow = true;
    t.dev.handleWrite = (text: string) => {
      if (swallow && text.includes('MODE MANUAL')) {
        swallow = false;
        return []; // reply lost, command not executed
      }
      return orig(text);
    };
    t.ctl.setMode('manual');
    await tick(300);
    expect(t.v().mode).toMatchObject({ current: 'manual', switching: true });
    // TLM still says auto: an in-flight switch is not undone by an older frame
    expect(t.client.getState().tlm!.mode).toBe('auto');
    await tick(2000);
    expect(t.dev.commandLog.filter(c => c === 'MODE').length).toBe(2); // connect + re-query
    expect(t.v().mode).toMatchObject({ current: 'auto', switching: false });
    t.done();
  });

  it('§11.4.6 app ESTOP 1 in auto: OK ESTOP 1 -> EVT MODE MANUAL ESTOP, no EVT ESTOP; §11.6.4 unlock stays manual 0', async () => {
    const t = await setup();
    t.ctl.stopAll();
    await tick(200);
    const rx = t.log().filter(l => l.startsWith('<') && !l.startsWith('< {'));
    expect(rx.slice(-2)).toEqual(['< OK ESTOP 1', '< EVT MODE MANUAL ESTOP']);
    expect(rx.some(l => l.startsWith('< EVT ESTOP'))).toBe(false);
    expect(t.client.getState()).toMatchObject({ estop: true, estopSource: 'app', mode: 'manual' });
    expect(t.banner()).toEqual(['Everything is stopped', 'Tap Unlock, then Auto to resume.']);
    expect(t.v().mode.autoAllowed).toBe(false);
    // §11.4.10: MODE AUTO is not sent while latched; the firmware would refuse it
    expect(t.client.setMode('auto')).toBe(false);
    await (t.client as unknown as { write: (l: string, u: boolean) => Promise<void> }).write(
      'MODE AUTO',
      true,
    );
    await tick(100);
    expect(t.log()).toContain('< ERR ESTOP MODE');
    expect(t.v().toast).toBeNull();
    t.ctl.release();
    await tick(200);
    expect(t.dev.snapshot().estop).toBe(false);
    expect(t.dev.mode).toBe('manual');
    expect(t.client.getState().mode).toBe('manual');
    expect(t.banner()).toEqual(['Auto is off', 'Tap Auto to turn it back on.']);
    expect(t.wing()).toMatchObject({ readOnly: false, values: { A: 0, B: 0 } });
    // user taps Auto: no auto-resume otherwise
    t.ctl.setMode('auto');
    await tick(200);
    expect(t.client.getState().mode).toBe('auto');
    expect(t.v().banner).toBeNull();
    t.done();
  });

  it('§11.4.6 START key in auto: EVT ESTOP 1 -> EVT MODE MANUAL KEY; §11.6.4 key unlock with phone stays manual', async () => {
    const t = await setup();
    t.transport.pressStartKey(t.id);
    await tick(200);
    const rx = t.log().filter(l => l.startsWith('< EVT'));
    expect(rx.slice(-2)).toEqual(['< EVT ESTOP 1', '< EVT MODE MANUAL KEY']);
    expect(t.banner()).toEqual(['Stopped with the device button', 'Tap Unlock, then Auto to resume.']);
    t.transport.pressStartKey(t.id);
    await tick(200);
    expect(t.dev.mode).toBe('manual');
    expect(t.client.getState()).toMatchObject({ estop: false, mode: 'manual' });
    expect(t.banner()).toEqual(['Auto is off', 'Tap Auto to turn it back on.']);
    t.done();
  });

  it('§11.3.4 / §11.5.4 over-temp in auto -> manual, notice, no auto-resume after cooling', async () => {
    const t = await setup();
    t.dev.ntcOverride = 43;
    await tick(300);
    const rx = t.log().filter(l => l.startsWith('< EVT'));
    expect(rx.slice(-2)).toEqual(['< EVT OVERTEMP 1', '< EVT MODE MANUAL OVERTEMP']);
    expect(t.banner()).toEqual(['Too warm, Auto is off', '43 °C now. Tap Auto below 39 °C.']);
    const n = t.dev.commandLog.length;
    t.dev.ntcOverride = 36;
    await tick(500);
    expect(t.client.getState()).toMatchObject({ overTemp: false, mode: 'manual' });
    expect(t.banner()).toEqual(['Cooled down, Auto is off', 'Tap Auto to turn it back on.']);
    expect(t.since(n)).not.toContain('MODE AUTO');
    t.done();
  });

  it('§11.3.4 low battery in auto -> manual + notice', async () => {
    const t = await setup();
    t.dev.vbatOverride = 3.3;
    await tick(300);
    expect(
      t
        .log()
        .filter(l => l.startsWith('< EVT'))
        .slice(-2),
    ).toEqual(['< EVT LOWBAT 1', '< EVT MODE MANUAL LOWBAT']);
    expect(t.banner()).toEqual(['Battery low, Auto is off', '3.30 V. Charge to continue.']);
    t.done();
  });

  it('§11.3.4 STOP in auto (global pill) -> EVT MODE MANUAL STOP -> "Stopped, Auto is off"; §11.6.1 later BLE drop returns to auto', async () => {
    const t = await setup();
    await t.client.stop();
    await tick(200);
    expect(t.log()).toContain('< EVT MODE MANUAL STOP');
    expect(t.banner()).toEqual(['Stopped, Auto is off', 'Tap Auto to turn it back on.']);
    t.transport.simulateLinkLoss(t.id);
    expect(t.dev.mode).toBe('auto');
    expect(t.dev.modeReason).toBe('BLE_DISCONNECT');
    t.done();
  });

  it('§11.5.3 HB timeout in a manual takeover -> device back on Auto, EVT MODE AUTO HOST_TIMEOUT, notice', async () => {
    const t = await setup();
    await t.takeOver();
    t.ctl.setWingValue('A', 40);
    await tick(300);
    // the app freezes: no TLM -> no PING (RATE 0 is the last command it sends)
    await (t.client as unknown as { write: (l: string, u: boolean) => Promise<void> }).write('RATE 0', true);
    await tick(10_500);
    expect(t.log()).toContain('< EVT MODE AUTO HOST_TIMEOUT');
    expect(t.dev.mode).toBe('auto');
    expect(t.dev.snapshot().lra).toEqual([0, 0]); // manual outputs zeroed first
    await (t.client as unknown as { write: (l: string, u: boolean) => Promise<void> }).write('RATE 10', true);
    await tick(300);
    expect(t.client.getState().mode).toBe('auto');
    expect(t.banner()).toEqual(['Back on Auto', 'The app paused, so Auto took over.']);
    // §11.4.12: HB timeout never latches: the user can take over again at once
    await t.takeOver();
    expect(t.v().banner).toBeNull();
    t.done();
  });

  it('§11.5.3 HB timeout in auto is ignored', async () => {
    const t = await setup();
    await (t.client as unknown as { write: (l: string, u: boolean) => Promise<void> }).write('RATE 0', true);
    await tick(12_000);
    expect(t.log().filter(l => l.startsWith('< EVT MODE'))).toEqual([]);
    expect(t.dev.mode).toBe('auto');
    t.done();
  });

  it('§11.4.12 PING is driven by TLM (≥ 3 s idle); a live app never times out its takeover', async () => {
    const t = await setup();
    await t.takeOver();
    const n = t.dev.commandLog.length;
    await tick(25_000);
    const pings = t.dev.commandLog.slice(n).filter(c => c === 'PING').length;
    expect(pings).toBeGreaterThanOrEqual(7);
    expect(pings).toBeLessThanOrEqual(9);
    expect(t.dev.mode).toBe('manual');
    expect(t.log().some(l => l.includes('HOST_TIMEOUT'))).toBe(false);
    t.done();
  });

  it('§11.4.12 HB out of range -> ERR RANGE HB (no toast)', async () => {
    const t = await setup();
    await (t.client as unknown as { write: (l: string, u: boolean) => Promise<void> }).write('HB 3', true);
    await tick(100);
    expect(t.log()).toContain('< ERR RANGE HB');
    expect(t.v().toast).toBeNull();
    t.done();
  });

  it('§11.6.3 leaving the page: auto -> nothing; takeover -> MODE AUTO (hand back); latched -> STOP', async () => {
    expect(MANUAL_LEAVE_ACTION).toBe('handback');
    const t = await setup();
    let n = t.dev.commandLog.length;
    t.ctl.leave();
    await tick(200);
    expect(t.since(n)).toEqual([]);
    expect(t.dev.mode).toBe('auto');

    t.ctl.enter();
    await t.takeOver();
    t.ctl.setWingValue('A', 50);
    await tick(300);
    n = t.dev.commandLog.length;
    t.ctl.leave();
    await tick(200);
    expect(t.since(n)).toEqual(['MODE AUTO']);
    expect(t.log()).toContain('< EVT MODE AUTO CMD');
    expect(t.dev.snapshot().lra).toEqual([0, 0]); // firmware zeroes, then auto (§11.6.3)
    expect(t.dev.mode).toBe('auto');

    t.ctl.enter();
    t.ctl.stopAll();
    await tick(200);
    n = t.dev.commandLog.length;
    t.ctl.leave();
    await tick(200);
    expect(t.since(n)).toEqual(['STOP']); // MODE AUTO would be ERR ESTOP MODE
    t.done();
  });

  it('§11.6.3 the leave action is one switch: "stop" keeps the takeover at 0', async () => {
    const t = await setup();
    await t.takeOver();
    const n = t.dev.commandLog.length;
    t.client.releaseControl('test', 'stop');
    await tick(200);
    expect(t.since(n)).toEqual(['STOP']);
    expect(t.dev.mode).toBe('manual');
    t.done();
  });

  it('background: takeover -> MODE AUTO + RATE 2; auto -> RATE 2 only; foreground -> RATE 10', async () => {
    const t = await setup();
    await t.takeOver();
    let n = t.dev.commandLog.length;
    t.client.onAppBackground();
    await tick(200);
    expect(t.since(n)).toEqual(['MODE AUTO', 'RATE 2']);
    n = t.dev.commandLog.length;
    t.client.onAppForeground();
    await tick(100);
    expect(t.since(n)).toEqual(['RATE 10']);
    n = t.dev.commandLog.length;
    t.client.onAppBackground();
    await tick(100);
    expect(t.since(n)).toEqual(['RATE 2']);
    t.done();
  });

  it('§11.5.2 BLE drop during a takeover: device back on Auto; reconnect reads AUTO BLE_DISCONNECT; app sends no MODE AUTO', async () => {
    const t = await setup();
    await t.takeOver();
    t.ctl.setWingValue('A', 60);
    await tick(300);
    t.transport.simulateLinkLoss(t.id);
    await tick(20);
    expect(t.dev.mode).toBe('auto');
    expect(t.dev.snapshot().lra).toEqual([0, 0]);
    expect(t.banner()).toEqual(['Connection lost', 'Device is on Auto.']);
    const n = t.dev.commandLog.length;
    await tick(600); // auto-reconnect
    expect(t.client.getState().status).toBe('connected');
    expect(t.since(n).slice(0, 3)).toEqual(['RATE 10', 'HB 10', 'MODE']);
    expect(t.since(n)).not.toContain('MODE AUTO');
    expect(t.client.getState()).toMatchObject({ mode: 'auto', modeReason: 'BLE_DISCONNECT' });
    expect(t.banner()).toEqual(['Back on Auto', 'The link dropped, so Auto took over.']);
    t.done();
  });

  it('§11.5.2 BLE drop in auto: auto keeps running, no notice after reconnect', async () => {
    const t = await setup();
    t.transport.simulateLinkLoss(t.id);
    expect(t.dev.mode).toBe('auto');
    await tick(600);
    expect(t.client.getState()).toMatchObject({ status: 'connected', mode: 'auto' });
    expect(t.v().banner).toBeNull();
    t.done();
  });

  it('§11.6.2 BLE drop while latched: stays manual + latched (no return to auto)', async () => {
    const t = await setup();
    t.ctl.stopAll();
    await tick(200);
    t.transport.simulateLinkLoss(t.id);
    await tick(20);
    expect(t.dev.mode).toBe('manual');
    expect(t.dev.snapshot().estop).toBe(true);
    expect(t.banner()).toEqual(['Connection lost', 'Everything stopped.']);
    await tick(600);
    expect(t.client.getState()).toMatchObject({ status: 'connected', mode: 'manual', estop: true });
    t.done();
  });

  it('§11.4.14 PZERO: auto -> OK PZERO then EVT PZERO; manual -> ERR MODE MANUAL PZERO', async () => {
    const t = await setup();
    t.ctl.pzero();
    expect(t.v().toast).toMatchObject({ title: 'Re-zeroing pressure' });
    await tick(100);
    expect(t.log()).toContain('< OK PZERO');
    expect(t.v().mode.pzero).toBe('busy');
    await tick(400);
    expect(t.log()).toContain('< EVT PZERO');
    expect(t.v().toast).toMatchObject({ title: 'Pressure re-zeroed' });
    expect(t.v().mode.pzero).toBe('available');
    await t.takeOver();
    expect(t.client.pzero()).toBe(false);
    await (t.client as unknown as { write: (l: string, u: boolean) => Promise<void> }).write('PZERO', true);
    await tick(100);
    expect(t.log()).toContain('< ERR MODE MANUAL PZERO');
    expect(t.v().toast).toMatchObject({ title: "Couldn't re-zero" });
    t.done();
  });

  it('§11.3.9 PAUSE key in auto -> EVT PZERO -> toast', async () => {
    const t = await setup();
    t.transport.pressPauseKey(t.id);
    await tick(100);
    expect(t.v().toast).toMatchObject({ title: 'Pressure re-zeroed' });
    t.done();
  });

  it('§11.4.4 sensors partly failed: auto keeps the others; sensor row + notice', async () => {
    const t = await setup();
    t.dev.srcOverride = { fsr: [1, 0], ppg: [1, 1, 0, 1] };
    await tick(4000);
    expect(t.egg().sensors).toEqual({ pressure: 'part', upper: 'ok', lower: 'off', overall: 'part' });
    expect(t.banner()).toEqual(['Some sensors are off', 'Auto keeps those outputs off.']);
    expect(t.client.getState().tlm!.lra[1]).toBe(0); // lower wings follow J23 (ppg[2]) -> 0
    expect(t.client.getState().tlm!.lra[0]).toBeGreaterThan(0);
    t.done();
  });

  it('§11.4.4 all sensors failed: stays AUTO with outputs 0; hint only', async () => {
    const t = await setup();
    t.dev.srcOverride = { fsr: [0, 0], ppg: [0, 0, 0, 0] };
    await tick(4000);
    const s = t.client.getState();
    expect(s.mode).toBe('auto');
    expect(s.tlm!.lra).toEqual([0, 0]);
    expect(s.tlm!.vcm.on).toBe(false);
    expect(t.banner()).toEqual(['Auto has no signal', 'Check the sensors touch skin.']);
    t.done();
  });

  it('§11.4.3 AUTO alias on ICD001-1 answers like MODE', async () => {
    const t = await setup();
    await (t.client as unknown as { write: (l: string, u: boolean) => Promise<void> }).write('AUTO 0', true);
    await tick(100);
    expect(t.log().slice(-4)).toEqual(expect.arrayContaining(['< OK MODE MANUAL', '< EVT MODE MANUAL CMD']));
    expect(t.client.getState().mode).toBe('manual');
    t.done();
  });

  it('§11.5.6 EVT MODE MANUAL TIMEOUT (maxMin) parses, shows no notice', async () => {
    const t = await setup();
    t.client.onLine('EVT MODE MANUAL TIMEOUT');
    expect(t.client.getState()).toMatchObject({ mode: 'manual', modeReason: 'TIMEOUT' });
    expect(t.v().banner).toBeNull();
    t.done();
  });

  it('§11.4.12 manual HB event of the earlier draft (EVT HOST_TIMEOUT STOP) is tolerated', async () => {
    const t = await setup();
    await t.takeOver();
    t.client.onLine('EVT HOST_TIMEOUT STOP');
    expect(t.client.getState().mode).toBe('manual');
    t.done();
  });

  it('a mode change seen first in TLM gets its reason from the EVT that follows', async () => {
    const t = await setup();
    const tlm = (mode: string) =>
      `{"t":1,"lra":[0,0],"vhz":0,"estop":1,"ot":0,"lb":0,"mode":"${mode}","src":{"fsr":[1,1],"ppg":[1,1,1,1]}}`;
    t.client.onLine(tlm('manual'));
    t.client.onLine('EVT ESTOP 1');
    t.client.onLine('EVT MODE MANUAL KEY');
    expect(t.client.getState().modeChange).toMatchObject({ from: 'auto', to: 'manual', reason: 'KEY' });
    expect(t.banner()).toEqual(['Stopped with the device button', 'Tap Unlock, then Auto to resume.']);
    t.done();
  });

  it('global "Auto on" pill: only ICD001-1, connected, auto, no control page focused', async () => {
    const t = await setup();
    const s = t.client.getState();
    expect(autoPillVisible(s, false)).toBe(true);
    expect(autoPillVisible(s, true)).toBe(false);
    expect(autoPillVisible({ ...s, mode: 'manual' }, false)).toBe(false);
    expect(autoPillVisible({ ...s, status: 'reconnecting' }, false)).toBe(false);
    expect(autoPillVisible({ ...s, autoSupported: false }, false)).toBe(false);
    expect(autoSensors(null, s.info)).toBeNull();
    t.done();
  });
});
