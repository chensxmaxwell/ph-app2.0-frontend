import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  AdvancedControlController,
  IntensityView,
  RhythmView,
  SensorView,
  STAGE_TINT,
} from '../../src/screens/advanced-control/controller';
import { Icd001Client } from '../../src/services/icd001/client';
import { MockIcd001Device, MockIcd001Transport } from '../../src/services/icd001/mock';

const tick = async (ms: number) => {
  for (let i = 0; i < ms; i += 10) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

async function setup(variant: 'icd1' | 'h11' = 'icd1', pre?: (dev: MockIcd001Device) => void) {
  const dev = new MockIcd001Device(variant, variant === 'icd1' ? 'ICD1-TEST' : 'H11-91B1');
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
  await tick(300);
  expect(await p).toBe(true);
  const v = () => ctl.getView();
  const wing = () => v().cards.find(c => c.kind === 'intensity') as IntensityView;
  const pulse = () => v().cards.find(c => c.kind === 'rhythm') as RhythmView;
  const egg = () => v().cards.find(c => c.kind === 'sensor') as SensorView | undefined;
  const done = () => {
    ctl.dispose();
    client.destroy();
  };
  return { dev, transport, client, ctl, id, device, v, wing, pulse, egg, done };
}

describe('AdvancedControlController (view-model) on the simulator', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 9_000_000 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('normal state: three cards from INFO, device strip, egg read-only 待硬件', async () => {
    const t = await setup();
    expect(t.v().screen).toMatchObject({ kind: 'normal', controlsEnabled: true });
    expect(t.v().banner).toBeNull();
    expect(t.v().cards.map(c => c.kind)).toEqual(['intensity', 'rhythm', 'sensor']);
    expect(t.v().device).toMatchObject({
      connected: true,
      name: 'ICD1-TEST',
      tempText: '34.2°C',
      batteryPct: 69,
    });
    expect(t.pulse().card.range).toEqual({ min: 10, max: 50, def: 10 });
    expect(t.pulse().presets).toEqual({ soft: 14, medium: 30, strong: 46 });
    expect(t.egg()).toMatchObject({ enabled: true, actuator: 'needs-hardware' });
    expect(t.wing().summary).toBe('A 0 · B 0 · Steady');
    t.done();
  });

  it('legacy H11: no bullet card, pulse uses VCM 2–20', async () => {
    const t = await setup('h11');
    expect(t.v().cards.map(c => c.kind)).toEqual(['intensity', 'rhythm']);
    t.ctl.setPulseHz(10); // Output off: only remembered
    await tick(300);
    expect(t.dev.commandLog.filter(c => c.startsWith('VCM'))).toEqual([]);
    t.ctl.setPulseOn(true);
    await tick(300);
    expect(t.dev.commandLog).toContain('VCM 1 50');
    t.done();
  });

  it('wing slider / link / switch map to LRA 0|1|BOTH and restore last values', async () => {
    const t = await setup();
    t.ctl.setWingValue('A', 60);
    t.ctl.setWingValue('B', 40);
    await tick(400);
    expect(t.dev.snapshot().lra).toEqual([60, 40]);
    expect(t.wing()).toMatchObject({ on: true, values: { A: 60, B: 40 }, summary: 'A 60 · B 40 · Steady' });
    expect(t.v().running).toEqual({ upper: true, lower: true, head: false });

    t.ctl.setWingOn(false);
    await tick(300);
    expect(t.dev.commandLog).toContain('LRA BOTH 0');
    expect(t.dev.snapshot().lra).toEqual([0, 0]);
    expect(t.wing().on).toBe(false);

    t.ctl.setWingOn(true);
    await tick(300);
    expect(t.dev.snapshot().lra).toEqual([60, 40]);

    t.ctl.toggleLink(); // aligns B to A
    await tick(300);
    expect(t.dev.snapshot().lra).toEqual([60, 60]);
    t.dev.commandLog.length = 0;
    t.ctl.setWingValue('B', 30);
    await tick(300);
    expect(t.dev.commandLog).toEqual(expect.arrayContaining(['LRA BOTH 30']));
    expect(t.dev.snapshot().lra).toEqual([30, 30]);
    t.done();
  });

  it('rhythm mode sends LPULSE', async () => {
    const t = await setup();
    t.ctl.setWingValue('A', 50);
    await tick(300);
    t.ctl.setWingRhythm('fast');
    await tick(300);
    expect(t.dev.commandLog).toContain('LPULSE 0 50 150 150');
    await tick(1000); // telemetry now reports lp -> summary follows the device
    expect(t.wing().summary).toBe('A 50 · B 0 · Rhythm');
    t.done();
  });

  it('pulse slider with Output off only remembers the rhythm; the switch sends it', async () => {
    const t = await setup();
    t.ctl.setPulseHz(36);
    await tick(300);
    expect(t.dev.commandLog.filter(c => c.startsWith('VHZ'))).toEqual([]);
    expect(t.pulse()).toMatchObject({ on: false, hz: 36, row: { kind: 'off', text: 'Off' } });
    t.ctl.setPulseOn(true);
    await tick(300);
    expect(t.dev.commandLog).toContain('VHZ 36');
    expect(t.pulse().row).toEqual({ kind: 'hz', hz: 36 });
    t.done();
  });

  it('pulse slider, presets, switch -> VHZ; a fast drag is throttled, final value wins', async () => {
    const t = await setup();
    t.ctl.setPulseOn(true);
    await tick(300);
    t.dev.commandLog.length = 0;
    for (let hz = 10; hz <= 50; hz++) {
      t.ctl.setPulseHz(hz);
      await tick(10);
    }
    await tick(300);
    const vhz = t.dev.commandLog.filter(c => c.startsWith('VHZ'));
    expect(vhz.length).toBeLessThanOrEqual(6);
    expect(vhz[vhz.length - 1]).toBe('VHZ 50');
    expect(t.pulse()).toMatchObject({ on: true, hz: 50, beat: 'Strong', summary: '50 Hz · Strong' });
    t.ctl.setPulseHz(30, true);
    await tick(300);
    t.ctl.setPulseOn(false);
    await tick(300);
    expect(t.dev.commandLog.slice(-1)[0]).toBe('VHZ 0');
    expect(t.pulse()).toMatchObject({ on: false, hz: 30, summary: 'Off' });
    t.ctl.setPulseOn(true);
    await tick(300);
    expect(t.dev.snapshot()).toMatchObject({ vcmOn: true, vcmHz: 30 });
    t.done();
  });

  it('hotspot zones: upper = group A, lower = group B (§8.5), head = pulse, bullet = sensor', async () => {
    const t = await setup();
    t.ctl.selectPart('head');
    expect(t.v().expanded).toBe('vcm');
    expect(t.pulse().expanded).toBe(true);
    t.ctl.selectPart('lower');
    expect(t.v()).toMatchObject({ expanded: 'wing', focusedGroup: 'B' });
    t.ctl.selectPart('upper');
    expect(t.v()).toMatchObject({ expanded: 'wing', focusedGroup: 'A' });
    t.ctl.selectPart('bullet');
    expect(t.v()).toMatchObject({ expanded: 'egg', focusedGroup: null });
    t.ctl.toggleCard('egg');
    expect(t.v().expanded).toBeNull();
    const g = t.wing().card.groups;
    expect(g.map(x => [x.id, x.zone, x.name, x.label])).toEqual([
      ['A', 'upper', 'Upper wings', '上翼'],
      ['B', 'lower', 'Lower wings', '下翼'],
    ]);
    t.done();
  });

  it('STOP ALL -> E-stop state; controls paused and ignored; hold 2 s to release', async () => {
    const t = await setup();
    t.ctl.setWingValue('A', 60);
    await tick(300);
    t.ctl.stopAll();
    await tick(300);
    expect(t.v().screen.kind).toBe('estop');
    expect(t.v().banner?.title).toBe('Everything is stopped');
    expect(t.v().banner?.lines).toEqual(['All outputs are off.', 'Tap Unlock when you are ready.']);
    expect(t.wing().values).toEqual({ A: 0, B: 0 });
    expect(t.wing()).toMatchObject({ enabled: false, summary: 'Paused' });
    expect(t.egg()?.enabled).toBe(true);

    t.dev.commandLog.length = 0;
    t.ctl.setWingValue('A', 80);
    await tick(300);
    expect(t.dev.commandLog.filter(c => c.startsWith('LRA'))).toEqual([]);

    t.ctl.beginRelease();
    await tick(1000);
    expect(t.v().estop.holdProgress).toBeGreaterThan(0.4);
    t.ctl.cancelRelease();
    await tick(2000);
    expect(t.v().screen.kind).toBe('estop');
    expect(t.v().estop.holdProgress).toBe(0);

    t.ctl.beginRelease();
    await tick(2300);
    expect(t.dev.commandLog).toContain('ESTOP 0');
    expect(t.v().screen.kind).toBe('normal');
    t.done();
  });

  it('design v2: one tap on Release sends ESTOP 0', async () => {
    const t = await setup();
    t.ctl.stopAll();
    await tick(300);
    expect(t.v().estop.on).toBe(true);
    t.ctl.release();
    await tick(300);
    expect(t.dev.commandLog).toContain('ESTOP 0');
    expect(t.v().screen.kind).toBe('normal');
    t.done();
  });

  it('rows + stage: values, Off / No data, tint from intensity, dim / compact per state', async () => {
    const t = await setup();
    t.ctl.setWingValue('A', 60);
    t.ctl.setWingValue('B', 40);
    t.ctl.setPulseOn(true);
    await tick(3500); // heart rate warms up in the sim
    expect(t.wing().row).toEqual({ kind: 'ab', A: 60, B: 40 });
    expect(t.pulse().row).toEqual({ kind: 'hz', hz: 10 });
    expect(t.egg()?.row.kind).toBe('bpm');
    expect(t.v().stage).toMatchObject({ dim: false, compact: false, tint: { head: 0, egg: 0 } });
    expect(t.v().stage.tint.upper).toBeCloseTo(0.6 * STAGE_TINT.upper);
    expect(t.v().stage.tint.lower).toBeCloseTo(0.4 * STAGE_TINT.lower);
    t.ctl.selectPart('head');
    expect(t.v().stage).toMatchObject({ compact: true, tint: { head: STAGE_TINT.head, egg: 0 } });
    t.ctl.selectPart('bullet');
    expect(t.v().stage.tint).toMatchObject({ head: 0, egg: STAGE_TINT.egg });
    t.ctl.collapse();
    t.ctl.stopAll();
    await tick(300);
    expect(t.v().stage).toEqual({ dim: true, compact: true, tint: { upper: 0, lower: 0, head: 0, egg: 0 } });
    expect(t.wing().row).toEqual({ kind: 'off', text: 'Off' });
    expect(t.pulse().row).toEqual({ kind: 'off', text: 'Off' });
    expect(t.egg()?.row.kind).toBe('bpm'); // sensor keeps reading
    t.ctl.release();
    await tick(300);
    t.dev.ntcOverride = 42.6;
    await tick(500);
    expect(t.v().stage).toMatchObject({ dim: false, compact: true });
    t.transport.simulateLinkLoss(t.id);
    await tick(20);
    expect(t.v().stage.dim).toBe(true);
    expect(t.v().lastSeen.map(c => c.row)).toEqual([
      { kind: 'off', text: 'Off' },
      { kind: 'off', text: 'Off' },
      { kind: 'off', text: 'No data' },
    ]);
    expect(t.v().banner).toMatchObject({ title: 'Connection lost', action: 'reconnect' });
    t.done();
  });

  it('Reconnect reconnects to the last device', async () => {
    const t = await setup();
    await t.client.disconnect();
    await tick(50);
    expect(t.v().screen.kind).toBe('disconnected');
    t.ctl.reconnect();
    await tick(300);
    expect(t.v().screen.kind).toBe('normal');
    expect(t.v().device.name).toBe('ICD1-TEST');
    t.done();
  });

  it('wing frequency: device already at 170 Hz -> no FREQ is sent', async () => {
    const t = await setup();
    await tick(1500);
    expect(t.dev.commandLog.filter(l => l.startsWith('FREQ'))).toEqual([]);
    expect('freq' in t.wing()).toBe(false); // not exposed to the UI
    expect('setWingFreq' in t.ctl).toBe(false);
    t.done();
  });

  it('wing frequency: device reports 200 Hz -> FREQ 170 once after connect/INFO', async () => {
    const t = await setup('icd1', dev => {
      dev.freq = 200;
    });
    await tick(1500);
    expect(t.dev.commandLog.filter(l => l.startsWith('FREQ'))).toEqual(['FREQ 170']);
    expect(t.dev.freq).toBe(170);
    // later telemetry / UI activity does not send it again
    t.ctl.setWingValue('A', 30);
    await tick(1500);
    expect(t.dev.commandLog.filter(l => l.startsWith('FREQ'))).toEqual(['FREQ 170']);
    t.done();
  });

  it('device START key E-stop names the device button', async () => {
    const t = await setup();
    t.transport.pressStartKey(t.id);
    await tick(200);
    expect(t.v().banner?.lines[0]).toBe('Stopped with the button on the device.');
    t.done();
  });

  it('START key release of an app E-stop: normal state + "released on the device" notice (§8.3)', async () => {
    const t = await setup();
    t.ctl.stopAll();
    await tick(4000);
    t.ctl.beginRelease();
    await tick(500);
    t.transport.pressStartKey(t.id);
    await tick(100);
    expect(t.v().screen.kind).toBe('normal');
    expect(t.v().estop).toMatchObject({
      on: false,
      holdProgress: 0,
      lastChange: { on: false, source: 'device' },
    });
    expect(t.v().banner?.title).toBe('Released on the device');
    expect(t.dev.commandLog).not.toContain('ESTOP 0');
    await tick(4200);
    expect(t.v().banner).toBeNull();
    t.done();
  });

  it('thresholds come from INFO: over-temp banner uses ch.ot.clear', async () => {
    const dev0 = new MockIcd001Device('icd1', 'ICD1-TEST');
    dev0.safety = { ot: { trip: 40, clear: 36.5 }, lb: { trip: 3.4, clear: 3.7, holdS: 60 } };
    dev0.ntcOverride = 40.4;
    dev0.vbatOverride = 3.95;
    const client = new Icd001Client(new MockIcd001Transport([dev0], { mtu: 185, connectDelayMs: 10 }));
    const ctl = new AdvancedControlController(client);
    ctl.start();
    const p = client.connect({
      id: 'sim-ICD1-TEST',
      name: dev0.name,
      rssi: -50,
      kind: null,
      simulated: true,
    });
    await tick(1500);
    expect(await p).toBe(true);
    expect(ctl.getView().thresholds).toMatchObject({
      ot: { tripC: 40, clearC: 36.5 },
      fromInfo: { ot: true },
    });
    expect(ctl.getView().screen.kind).toBe('overtemp');
    expect(ctl.getView().banner?.lines[0]).toBe(
      'Device at 40.4 °C. Outputs resume once it cools below 36.5 °C.',
    );
    ctl.dispose();
    client.destroy();
  });

  it('low battery clears only after > 3.70 V for 60 s (firmware latch)', async () => {
    const t = await setup();
    t.dev.vbatOverride = 3.38;
    await tick(500);
    expect(t.v().screen.kind).toBe('lowbat');
    t.dev.vbatOverride = 3.9;
    await tick(58_000);
    expect(t.v().screen.kind).toBe('lowbat');
    await tick(3_000);
    expect(t.v().screen.kind).toBe('normal');
    t.done();
  });

  it('over-temp banner, then "Cooled down" for 4 s after release', async () => {
    const t = await setup();
    t.dev.ntcOverride = 42.3;
    await tick(1500);
    expect(t.v().screen.kind).toBe('overtemp');
    expect(t.v().banner).toMatchObject({ tone: 'warn', title: 'Too warm, paused' });
    expect(t.v().device.tempWarn).toBe(true);
    t.dev.ntcOverride = 38.5;
    await tick(1500);
    expect(t.v().screen.kind).toBe('normal');
    expect(t.v().banner?.title).toBe('Cooled down');
    await tick(4200);
    expect(t.v().banner).toBeNull();
    t.done();
  });

  it('priority with overlapping conditions: estop > overtemp > lowbat', async () => {
    const t = await setup();
    t.dev.vbatOverride = 3.38;
    await tick(1500);
    expect(t.v().screen.kind).toBe('lowbat');
    expect(t.v().banner?.title).toBe('Battery low, paused');
    expect(t.v().device).toMatchObject({ batteryPct: 0, batteryWarn: true });
    t.dev.ntcOverride = 42.3;
    await tick(1500);
    expect(t.v().screen).toMatchObject({ kind: 'overtemp', also: ['lowbat'] });
    t.ctl.stopAll();
    await tick(300);
    expect(t.v().screen).toMatchObject({ kind: 'estop', also: ['overtemp', 'lowbat'] });
    expect(t.v().banner?.lines.slice(2)).toEqual([
      'Also too warm (42.3 °C).',
      'Battery is also low (3.38 V).',
    ]);
    t.done();
  });

  it('link loss -> disconnected; Stop all offline is queued and ESTOP 1 goes out first on reconnect (v4 §5)', async () => {
    const t = await setup();
    t.ctl.setWingValue('B', 70);
    await tick(300);
    t.transport.simulateLinkLoss(t.id);
    await tick(20);
    expect(t.v().screen.kind).toBe('disconnected');
    expect(t.v().cards).toEqual([]);
    expect(t.v().lastSeen.map(c => c.summary)).toEqual(['—', '—', '—']);
    expect((t.v().lastSeen[0] as IntensityView).values).toEqual({ A: 0, B: 0 });
    expect(t.v().device).toMatchObject({ connected: false, lastName: 'ICD1-TEST' });
    expect(t.v().banner?.lines).toEqual(['Everything stopped.']);
    t.ctl.stopAll(); // still pressable offline
    expect(t.v().stopQueued).toBe(true);
    expect(t.client.queuedOnConnect).toBe('estop');
    expect(t.v().banner?.lines).toEqual(['Everything stopped.', 'Stays stopped after reconnect.']);
    t.dev.commandLog.length = 0;
    await tick(800); // auto-reconnect
    // first command on the new link is ESTOP 1, before RATE and any actuator command
    expect(t.dev.commandLog[0]).toBe('ESTOP 1');
    expect(t.dev.commandLog.findIndex(c => c.startsWith('RATE'))).toBeGreaterThan(0);
    expect(t.dev.commandLog.filter(c => /^(LRA|LPULSE|VHZ|VCM)/.test(c))).toEqual([]);
    // comes back Stopped (app source, OK ESTOP 1 only per §9), values 0
    expect(t.v().screen.kind).toBe('estop');
    expect(t.v().estop).toMatchObject({ on: true, source: 'app' });
    expect(t.v().banner?.title).toBe('Everything is stopped');
    expect(t.wing().values).toEqual({ A: 0, B: 0 });
    expect(t.v().stopQueued).toBe(false);
    expect(t.client.queuedOnConnect).toBeNull();
    // Unlock: ESTOP 0, everything stays at 0 (firmware keeps no set values, §7.5)
    t.dev.commandLog.length = 0;
    t.ctl.release();
    await tick(500);
    expect(t.dev.commandLog).toEqual(expect.arrayContaining(['ESTOP 0']));
    expect(t.v().screen.kind).toBe('normal');
    expect(t.wing().values).toEqual({ A: 0, B: 0 });
    expect(t.pulse().on).toBe(false);
    expect(t.dev.snapshot()).toMatchObject({ lra: [0, 0], vcmOn: false });
    t.done();
  });

  it('leaving the page while an offline e-stop is queued downgrades it to STOP (no hidden latch)', async () => {
    const t = await setup();
    t.transport.simulateLinkLoss(t.id);
    await tick(20);
    t.ctl.stopAll();
    expect(t.client.queuedOnConnect).toBe('estop');
    t.ctl.leave();
    expect(t.client.queuedOnConnect).toBe('stop');
    expect(t.v().stopQueued).toBe(false);
    t.dev.commandLog.length = 0;
    await tick(800);
    expect(t.dev.commandLog).not.toContain('ESTOP 1');
    const i = t.dev.commandLog.findIndex(c => c.startsWith('RATE'));
    expect(t.dev.commandLog[i + 1]).toBe('STOP');
    expect(t.v().screen.kind).toBe('normal');
    t.done();
  });

  it('e-stop while connected: values drop to 0 at once, Unlock keeps them at 0, pulse speed kept', async () => {
    const t = await setup();
    t.ctl.setWingValue('A', 40);
    t.ctl.setPulseOn(true);
    t.ctl.setPulseHz(24);
    await tick(300);
    t.ctl.stopAll();
    expect(t.wing().values).toEqual({ A: 0, B: 0 });
    await tick(300);
    expect(t.v().screen.kind).toBe('estop');
    expect(t.pulse()).toMatchObject({ on: false, hz: 24 });
    t.ctl.release();
    await tick(1500);
    expect(t.v().screen.kind).toBe('normal');
    expect(t.wing().values).toEqual({ A: 0, B: 0 });
    expect(t.pulse()).toMatchObject({ on: false, hz: 24 });
    t.done();
  });

  it('non-safety ERR after an input: toast + fall back to device values', async () => {
    const t = await setup();
    t.ctl.setWingValue('A', 70);
    t.client.onLine('ERR ARG LRA');
    expect(t.v().toast).toBe("Couldn't change Wings. Showing the device's current setting.");
    await tick(3100);
    expect(t.v().toast).toBeNull();
    t.done();
  });

  it('leaving the page sends STOP', async () => {
    const t = await setup();
    t.ctl.setPulseHz(30);
    await tick(300);
    t.dev.commandLog.length = 0;
    t.ctl.leave();
    await tick(100);
    expect(t.dev.commandLog).toContain('STOP');
    expect(t.dev.snapshot()).toMatchObject({ vcmOn: false, lra: [0, 0] });
    t.done();
  });
});
