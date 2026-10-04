import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Icd001Client } from '../../src/services/icd001/client';
import { MockIcd001Device, MockIcd001Transport } from '../../src/services/icd001/mock';
import { encodeCommand } from '../../src/services/icd001/protocol';
import { encodeUtf8 } from '../../src/services/icd001/utf8';

const tick = async (ms: number) => {
  for (let i = 0; i < ms; i += 10) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

function setup(variant: 'icd1' | 'h11', mtu = 23) {
  const dev = new MockIcd001Device(variant, variant === 'icd1' ? 'ICD1-TEST' : 'H11-91B1');
  const transport = new MockIcd001Transport([dev], { mtu, connectDelayMs: 10 });
  const client = new Icd001Client(transport, { reconnectDelaysMs: [100, 100] });
  return { dev, transport, client, id: `sim-${dev.name}` };
}

async function connect(client: Icd001Client, id: string, name: string) {
  const p = client.connect({
    id,
    name,
    rssi: -50,
    kind: null,
    simulated: true,
  });
  await tick(300); // connect delay + first telemetry frames
  expect(await p).toBe(true);
}

describe('Icd001Client + simulator', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 5_000_000 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('scan lists simulated devices', async () => {
    const transport = new MockIcd001Transport();
    const client = new Icd001Client(transport);
    await client.startScan();
    await tick(600);
    expect(
      client
        .getState()
        .devices.map(d => d.name)
        .sort(),
    ).toEqual(['H11-91B1', 'ICD1-5A3C']);
    client.destroy();
  });

  it('v0 device: INFO drives modules, TLM reassembled at MTU 23, VHZ used for voice coil', async () => {
    const { dev, client, id } = setup('icd1', 23);
    await connect(client, id, dev.name);
    const s = client.getState();
    expect(s.status).toBe('connected');
    expect(s.info?.prod).toBe('ICD-001');
    expect(s.info?.modules.vcm).toMatchObject({
      minHz: 2,
      maxHz: 50,
      command: 'VHZ',
    });
    expect(s.tlm?.ppg).toHaveLength(4);
    expect(s.locked).toBe(false);
    expect(dev.rate).toBe(10);

    expect(client.setVcmHz(35)).toBe(true);
    expect(client.setLra('A', 60)).toBe(true);
    await tick(400);
    expect(dev.snapshot()).toMatchObject({
      vcmOn: true,
      vcmHz: 35,
      lra: [60, 0],
    });
    expect(client.getState().tlm?.vcm).toEqual({ on: true, hz: 35 });

    client.setVcmHz(500); // out of range -> clamped to 50, never sent raw
    await tick(300);
    expect(dev.commandLog).toContain('VHZ 50');
    expect(dev.commandLog.some(c => c === 'VHZ 500')).toBe(false);
    client.destroy();
  });

  it('legacy H11 board: falls back to VCM on halfMs with 2–20 Hz', async () => {
    const { dev, client, id } = setup('h11', 185);
    await connect(client, id, dev.name);
    expect(client.getState().info?.modules.vcm?.command).toBe('VCM');
    client.setVcmHz(40);
    await tick(300);
    expect(dev.commandLog).toContain('VCM 1 25');
    expect(client.getState().tlm?.vcm.hz).toBe(20);
    client.destroy();
  });

  it('E-stop from the device key locks controls and blocks non-zero commands', async () => {
    const { dev, transport, client, id } = setup('icd1');
    await connect(client, id, dev.name);
    transport.pressStartKey(id);
    await tick(200);
    const s = client.getState();
    expect(s.estop).toBe(true);
    expect(s.locked).toBe(true);
    expect(s.lockReasons).toContain('estop');
    expect(client.setLra('A', 50)).toBe(false);
    expect(client.setLra('A', 0)).toBe(true); // turning off is always allowed
    const pe = client.setEstop(false);
    await tick(300);
    await pe;
    expect(client.getState().locked).toBe(false);
    client.destroy();
  });

  it('over-temp locks; ERR reply is surfaced', async () => {
    const { dev, client, id } = setup('icd1');
    await connect(client, id, dev.name);
    client.setLra('ALL', 80);
    await tick(200);
    dev.ntcOverride = 43;
    await tick(300);
    const s = client.getState();
    expect(s.overTemp).toBe(true);
    expect(s.lockReasons).toContain('overtemp');
    expect(s.tlm?.lra).toEqual([0, 0]); // firmware stopped
    client.destroy();
  });

  it('STOP for safety drops pending values and stops the device', async () => {
    const { dev, client, id } = setup('icd1');
    await connect(client, id, dev.name);
    client.setLra('A', 70);
    client.setLra('A', 90);
    client.stopForSafety('leave page');
    await tick(300);
    expect(dev.commandLog.slice(-1)[0]).toBe('STOP');
    expect(dev.snapshot().lra).toEqual([0, 0]);
    client.destroy();
  });

  it('link loss -> reconnecting -> connected, actuators remain off', async () => {
    const { dev, transport, client, id } = setup('icd1');
    await connect(client, id, dev.name);
    client.setLra('A', 50);
    await tick(200);
    transport.simulateLinkLoss(id);
    expect(client.getState().status).toBe('reconnecting');
    expect(client.getState().locked).toBe(true);
    expect(client.setLra('A', 50)).toBe(false);
    await tick(600);
    expect(client.getState().status).toBe('connected');
    expect(dev.snapshot().lra).toEqual([0, 0]);
    client.destroy();
  });

  it('user disconnect sends STOP and does not reconnect', async () => {
    const { dev, client, id } = setup('icd1');
    await connect(client, id, dev.name);
    const pd = client.disconnect();
    await tick(500);
    await pd;
    expect(dev.commandLog).toContain('STOP');
    expect(client.getState().status).toBe('disconnected');
    client.destroy();
  });

  it('marks telemetry stale when frames stop', async () => {
    const { dev, client, id } = setup('icd1');
    await connect(client, id, dev.name);
    dev.rate = 0;
    await tick(4500);
    expect(client.getState().lockReasons).toContain('stale');
    client.destroy();
  });
  it('ERR ESTOP (silent device-side estop) maps to a lock reason; value not stored', async () => {
    const { dev, client, id } = setup('icd1');
    await connect(client, id, dev.name);
    dev.rate = 0; // no telemetry to reveal the state; only the ERR does
    dev.estop = true;
    expect(client.setLra('B', 55)).toBe(true);
    await tick(100);
    const s = client.getState();
    expect(s.lastSafetyErr?.reason).toBe('ESTOP');
    expect(s.lockReasons).toContain('estop');
    expect(dev.snapshot().lra).toEqual([0, 0]);
    expect(client.setLra('B', 55)).toBe(false);
    client.destroy();
  });

  it('ERR OVERTEMP / ERR LOWBAT map to lock reasons', async () => {
    for (const [flag, reason] of [
      ['ot', 'overtemp'],
      ['lowbat', 'lowbat'],
    ] as const) {
      const { dev, client, id } = setup('icd1');
      await connect(client, id, dev.name);
      dev.rate = 0;
      // hold the latch inside its hysteresis band so the sim does not clear it
      dev.ntcOverride = 40;
      dev.vbatOverride = 3.5;
      dev[flag] = true;
      client.setVcmHz(20);
      await tick(100);
      expect(client.getState().lockReasons).toContain(reason);
      expect(dev.snapshot().vcmOn).toBe(false);
      client.destroy();
    }
  });

  it('firmware rejection order is ESTOP > OVERTEMP > LOWBAT; STOP/RATE/ESTOP 0 always accepted', () => {
    const d = new MockIcd001Device('icd1', 'ICD1-X');
    d.estop = true;
    d.ot = true;
    d.lowbat = true;
    expect(d.handleWrite('LRA 0 10\n')).toEqual(['ERR ESTOP']);
    expect(d.handleWrite('LPULSE 0 10 100 100\n')).toEqual(['ERR ESTOP']);
    expect(d.handleWrite('STOP\nRATE 5\nPING\n')).toEqual(['OK STOP', 'OK RATE 5', 'OK PONG']);
    expect(d.handleWrite('ESTOP 0\n')).toEqual(['OK ESTOP 0']);
    expect(d.handleWrite('VHZ 20\n')).toEqual(['ERR OVERTEMP']);
    d.ot = false;
    expect(d.handleWrite('VCM 1 50\n')).toEqual(['ERR LOWBAT']);
    expect(d.lra).toEqual([0, 0]);
  });

  it('low battery (v0): EVT LOWBAT 1 below 3.40 V; EVT LOWBAT 0 only after > 3.70 V held 60 s (§8.2)', async () => {
    const { dev, client, id } = setup('icd1');
    await connect(client, id, dev.name);
    dev.vbatOverride = 3.35;
    await tick(300);
    expect(client.getState().lowBattery).toBe(true);
    expect(client.getState().tlm?.lb).toBe(true);
    dev.vbatOverride = 3.65; // old 3.60 release no longer applies
    await tick(1000);
    expect(client.getState().lowBattery).toBe(true);
    dev.vbatOverride = 3.75;
    await tick(30_000);
    dev.vbatOverride = 3.69; // dip resets the 60 s hold
    await tick(500);
    dev.vbatOverride = 3.75;
    await tick(50_000);
    expect(client.getState().lowBattery).toBe(true);
    await tick(10_500);
    expect(client.getState().lowBattery).toBe(false);
    expect(client.getState().log.some(l => l.includes('EVT LOWBAT 0'))).toBe(true);
    client.destroy();
  });

  it('v0 thresholds follow INFO ch.ot / ch.lb (mock with non-default values)', async () => {
    const { dev, client, id } = setup('icd1');
    dev.safety = { ot: { trip: 40, clear: 37 }, lb: { trip: 3.5, clear: 3.8, holdS: 5 } };
    await connect(client, id, dev.name);
    expect(client.getState().info?.safety).toMatchObject({ ot: { tripC: 40, clearC: 37 }, lb: { holdS: 5 } });
    dev.ntcOverride = 40.2;
    await tick(300);
    expect(client.getState().overTemp).toBe(true);
    dev.ntcOverride = 37.5;
    await tick(300);
    expect(client.getState().overTemp).toBe(true);
    dev.ntcOverride = 36.9;
    await tick(300);
    expect(client.getState().overTemp).toBe(false);
    dev.vbatOverride = 3.45;
    await tick(300);
    expect(client.getState().lowBattery).toBe(true);
    dev.vbatOverride = 3.85;
    await tick(5_500);
    expect(client.getState().lowBattery).toBe(false);
    client.destroy();
  });

  it('legacy board: app-side low battery with fallback 3.40 / 3.70 V held 60 s, STOP on trip', async () => {
    const { dev, client, id } = setup('h11');
    await connect(client, id, dev.name);
    expect(client.getState().info?.safety.fromInfo).toEqual({ ot: false, lb: false });
    client.setLra('A', 50);
    await tick(300);
    expect(dev.snapshot().lra[0]).toBe(50);
    dev.commandLog.length = 0;
    dev.vbatOverride = 3.3;
    await tick(300);
    expect(client.getState().lockReasons).toContain('lowbat');
    expect(dev.commandLog).toContain('STOP');
    expect(dev.snapshot().lra[0]).toBe(0);
    dev.vbatOverride = 3.65; // above the old 3.60 release: still locked
    await tick(1000);
    expect(client.getState().lowBattery).toBe(true);
    dev.vbatOverride = 3.72;
    await tick(59_000);
    expect(client.getState().lowBattery).toBe(true);
    await tick(1_500);
    expect(client.getState().lowBattery).toBe(false);
    client.destroy();
  });

  it('legacy board: app-side over-temp with fallback 42 / 39 °C, STOP on trip', async () => {
    const { dev, client, id } = setup('h11');
    await connect(client, id, dev.name);
    client.setVcmHz(10);
    await tick(300);
    dev.commandLog.length = 0;
    dev.ntcOverride = 42.1;
    await tick(300);
    expect(client.getState().overTemp).toBe(true);
    expect(dev.commandLog).toContain('STOP');
    expect(client.setLra('A', 20)).toBe(false);
    dev.ntcOverride = 39.5;
    await tick(300);
    expect(client.getState().overTemp).toBe(true);
    dev.ntcOverride = 38.9;
    await tick(300);
    expect(client.getState().overTemp).toBe(false);
    client.destroy();
  });

  it('LPULSE on v0 (split across 20-byte writes at MTU 23), LRA cancels rhythm; legacy refuses', async () => {
    const { dev, client, id } = setup('icd1', 23);
    await connect(client, id, dev.name);
    expect(client.setLpulse('ALL', 100, 2000, 2000)).toBe(true);
    await tick(300);
    expect(dev.commandLog).toContain('LPULSE BOTH 100 2000 2000');
    expect(client.getState().tlm?.lp).toEqual([
      [2000, 2000],
      [2000, 2000],
    ]);
    client.setLra('B', 40);
    await tick(300);
    expect(dev.snapshot().lp).toEqual([
      [2000, 2000],
      [0, 0],
    ]);
    expect(dev.snapshot().lra).toEqual([100, 40]);
    client.destroy();

    const legacy = setup('h11');
    await connect(legacy.client, legacy.id, legacy.dev.name);
    expect(legacy.client.setLpulse('A', 50, 300, 300)).toBe(false);
    legacy.client.destroy();
  });

  it('v0 rx buffering: executes on \\n, idle 100 ms flush, 256-byte overflow', async () => {
    const { dev, transport, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    const lines: string[] = [];
    transport.onNotify((_, b) => lines.push(String.fromCharCode(...b)));
    await transport.write(id, encodeUtf8('LRA 0 '), false, true);
    await transport.write(id, encodeUtf8('33\n'), false, true);
    await tick(20);
    expect(dev.lra[0]).toBe(33);
    await transport.write(id, encodeUtf8('LRA 1 44'), false, true); // no terminator
    await tick(50);
    expect(dev.lra[1]).toBe(0);
    await tick(100);
    expect(dev.lra[1]).toBe(44);
    await transport.write(id, encodeUtf8('X'.repeat(180)), false, true);
    await transport.write(id, encodeUtf8('X'.repeat(100)), false, true);
    await tick(20);
    expect(lines.join('')).toContain('ERR OVERFLOW');
    client.destroy();
  });

  it('client writes are \\n-terminated', async () => {
    const { dev, transport, client, id } = setup('icd1');
    const writes: number[][] = [];
    const orig = transport.write.bind(transport);
    transport.write = async (i, b, r, s) => {
      writes.push(b);
      return orig(i, b, r, s);
    };
    await connect(client, id, dev.name);
    client.setLra('A', 12);
    await tick(200);
    expect(writes.length).toBeGreaterThan(0);
    writes.forEach(w => expect(w[w.length - 1]).toBe(0x0a));
    expect(writes).toContainEqual(encodeCommand('LRA 0 12'));
    client.destroy();
  });
  it('estopSource: app for STOP ALL, device for the START key; cleared on release', async () => {
    const { dev, transport, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    await client.setEstop(true);
    await tick(300);
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'app' });
    expect(client.getState().estopChange).toMatchObject({ on: true, source: 'app' });
    await tick(4000); // later TLM frames keep the source
    expect(client.getState().estopSource).toBe('app');
    await client.setEstop(false);
    await tick(200);
    expect(client.getState()).toMatchObject({ estop: false, estopSource: null });
    expect(client.getState().estopChange).toMatchObject({ on: false, source: 'app' });
    await tick(4000);
    transport.pressStartKey(id);
    await tick(200);
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'device' });
    expect(client.getState().estopChange).toMatchObject({ on: true, source: 'device' });
    client.destroy();
  });

  it('§9: ESTOP n is acknowledged only by OK ESTOP n (no EVT echo); app source comes from the reply', async () => {
    const { dev, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    const before = client.getState().log.length;
    await client.setEstop(true);
    await tick(300);
    const rx = client
      .getState()
      .log.slice(before)
      .filter(l => l.startsWith('<'));
    expect(rx.some(l => l.includes('OK ESTOP 1'))).toBe(true);
    expect(rx.some(l => l.includes('EVT ESTOP'))).toBe(false);
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'app' });
    // extra STOP while latched: OK STOP, latch unchanged, source unchanged
    await client.stop();
    await tick(300);
    expect(dev.snapshot().estop).toBe(true);
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'app' });
    expect(client.getState().log.some(l => l.includes('OK STOP'))).toBe(true);
    client.destroy();
  });

  it('§9: every EVT ESTOP is device-originated, even right after the app sent ESTOP (no 3 s window)', async () => {
    const { dev, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    await client.setEstop(true);
    await tick(50);
    expect(client.getState().estopChange).toMatchObject({ on: true, source: 'app' });
    // START key releases within 50 ms of the app's ESTOP 1 -> still the device
    client.onLine('EVT ESTOP 0');
    expect(client.getState()).toMatchObject({ estop: false, estopSource: null });
    expect(client.getState().estopChange).toMatchObject({ on: false, source: 'device' });
    // the app releases, then an EVT ESTOP 1 arrives immediately -> device
    client.onLine('EVT ESTOP 1');
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'device' });
    expect(client.getState().estopChange).toMatchObject({ on: true, source: 'device' });
    // a raw OK ESTOP 0 is our release
    client.onLine('OK ESTOP 0');
    expect(client.getState().estopChange).toMatchObject({ on: false, source: 'app' });
    client.destroy();
  });

  it('§8.3 START key releases an app E-stop without ESTOP 0 (EVT ESTOP 0 + TLM are the truth)', async () => {
    const { dev, transport, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    await client.setEstop(true);
    await tick(4000);
    dev.commandLog.length = 0;
    transport.pressStartKey(id);
    await tick(50);
    expect(dev.commandLog).not.toContain('ESTOP 0');
    expect(client.getState()).toMatchObject({ estop: false, estopSource: null, locked: false });
    expect(client.getState().estopChange).toMatchObject({ on: false, source: 'device' });
    expect(client.getState().log.some(l => l.includes('EVT ESTOP 0'))).toBe(true);
    expect(client.setLra('A', 30)).toBe(true);
    await tick(300);
    expect(dev.snapshot().lra[0]).toBe(30);
    client.destroy();
  });

  it('TLM estop alone (EVT lost) still flips the state; ERR ESTOP does not set it but triggers GET (§8.6)', async () => {
    const { dev, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    dev.estop = true; // firmware latched, EVT missed
    await tick(300);
    // no EVT ESTOP on this connection -> not attributed to the device button (audit F2)
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'unknown' });
    dev.estop = false;
    await tick(300);
    expect(client.getState().estop).toBe(false);
    dev.commandLog.length = 0;
    client.onLine('ERR ESTOP');
    expect(client.getState().estop).toBe(false);
    expect(client.getState().lastSafetyErr?.reason).toBe('ESTOP');
    await tick(200);
    expect(dev.commandLog).toContain('GET');
    client.destroy();
  });

  it('requestStopOnConnect sends STOP right after RATE on the next connect', async () => {
    const { dev, client, id } = setup('icd1', 185);
    client.requestStopOnConnect();
    await connect(client, id, dev.name);
    const i = dev.commandLog.findIndex(c => c.startsWith('RATE'));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(dev.commandLog[i + 1]).toBe('STOP');
    await client.disconnect();
    dev.commandLog.length = 0;
    await connect(client, id, dev.name); // one-shot
    expect(dev.commandLog).not.toContain('STOP');
    client.destroy();
  });

  it('requestEstopOnConnect: ESTOP 1 is the first command on the next connect; OK ESTOP 1 -> estop (app)', async () => {
    const { dev, client, id } = setup('icd1', 185);
    client.requestEstopOnConnect();
    client.requestStopOnConnect(); // does not downgrade a queued e-stop
    expect(client.queuedOnConnect).toBe('estop');
    await connect(client, id, dev.name);
    expect(dev.commandLog[0]).toBe('ESTOP 1');
    expect(dev.commandLog.findIndex(c => c.startsWith('RATE'))).toBe(1);
    expect(dev.commandLog).not.toContain('STOP');
    await tick(100);
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'app', locked: true });
    expect(client.getState().log.some(l => l.includes('EVT ESTOP'))).toBe(false); // §9: OK only
    expect(client.queuedOnConnect).toBeNull();
    client.destroy();
  });

  it('downgradeQueuedEstop turns a queued ESTOP 1 into STOP', async () => {
    const { dev, client, id } = setup('icd1', 185);
    client.downgradeQueuedEstop(); // nothing queued: no-op
    expect(client.queuedOnConnect).toBeNull();
    client.requestEstopOnConnect();
    client.downgradeQueuedEstop();
    expect(client.queuedOnConnect).toBe('stop');
    await connect(client, id, dev.name);
    expect(dev.commandLog).not.toContain('ESTOP 1');
    const i = dev.commandLog.findIndex(c => c.startsWith('RATE'));
    expect(dev.commandLog[i + 1]).toBe('STOP');
    client.destroy();
  });
  it('§10.5: mock and client agree on the verbatim OK replies (OK LRA <A> <B>, OK VHZ <hz>, OK FREQ <f>)', async () => {
    const { dev, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    const replies: string[] = [client.getState().lastReply ?? ''];
    const unsub = client.subscribe(s => {
      if (s.lastReply && replies[replies.length - 1] !== s.lastReply) {
        replies.push(s.lastReply);
      }
    });
    client.setLra('A', 40);
    await tick(200);
    expect(client.getState().lastAck).toMatchObject({ cmd: 'LRA', a: 40, b: 0 });
    client.setLra('B', 25);
    await tick(200);
    expect(client.getState().lastAck).toMatchObject({ cmd: 'LRA', a: 40, b: 25 }); // both groups' current values
    client.setVcmHz(18);
    await tick(200);
    expect(client.getState().lastAck).toMatchObject({ cmd: 'VHZ', hz: 18 });
    client.setVcmHz(0);
    await tick(200);
    expect(client.getState().lastAck).toMatchObject({ cmd: 'VHZ', hz: 0 });
    client.setFreq(170);
    await tick(200);
    expect(client.getState().lastAck).toMatchObject({ cmd: 'FREQ', f: 170 });
    unsub();
    expect(replies.slice(1)).toEqual(['OK LRA 40 0', 'OK LRA 40 25', 'OK VHZ 18', 'OK VHZ 0', 'OK FREQ 170']);
    // a malformed OK keeps the previous ack and is flagged in the log
    client.onLine('OK LRA 40');
    expect(client.getState().lastAck).toMatchObject({ cmd: 'FREQ', f: 170 });
    expect(client.getState().log[client.getState().log.length - 1]).toContain('malformed OK');
    client.destroy();
  });

  it('§10.4: telemetry wing frequency is `f`; `lra_f` is not read', () => {
    const { client } = setup('icd1');
    client.onLine('{"t":1,"lra":[0,0],"vhz":0,"f":170}');
    expect(client.getState().tlm?.lraFreqHz).toBe(170);
    client.onLine('{"t":2,"lra":[0,0],"vhz":0,"lra_f":200}');
    expect(client.getState().tlm?.lraFreqHz).toBeNull();
    client.destroy();
  });

  it('§10.3: ESTOP 1 is never blocked by the client (over-temp + low battery + already latched)', async () => {
    const { dev, client, id } = setup('icd1', 185);
    dev.ntcOverride = 43;
    dev.vbatOverride = 3.3;
    await connect(client, id, dev.name);
    await tick(1500);
    expect(client.getState()).toMatchObject({ overTemp: true, lowBattery: true, locked: true });
    expect(client.setLra('A', 30)).toBe(false); // actuators refused while locked
    dev.commandLog.length = 0;
    await client.setEstop(true);
    await tick(100);
    await client.setEstop(true); // already latched: sent again, never deduped
    await tick(100);
    expect(dev.commandLog).toEqual(['ESTOP 1', 'ESTOP 1']);
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'app' });
    expect(client.getState().lastAck).toMatchObject({ cmd: 'ESTOP', on: true });
    client.destroy();
  });

  it('F2 / §10.1: latch kept over a reconnect: app stop -> app; START-key stop -> unknown (no EVT this link)', async () => {
    const { dev, transport, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    await client.setEstop(true);
    await tick(200);
    transport.simulateLinkLoss(id);
    await tick(600);
    expect(client.getState()).toMatchObject({ status: 'connected', estop: true, estopSource: 'app' });
    // START key twice: release + engage via EVT on this link -> device
    transport.pressStartKey(id);
    await tick(100);
    transport.pressStartKey(id);
    await tick(100);
    expect(client.getState()).toMatchObject({ estop: true, estopSource: 'device' });
    transport.simulateLinkLoss(id);
    await tick(600);
    expect(client.getState()).toMatchObject({ status: 'connected', estop: true, estopSource: 'unknown' });
    expect(client.getState().estopChange).toMatchObject({ on: true, source: 'unknown' });
    client.destroy();
  });

  it('dedupe: a rejected (ERR) value can be sent again right away; ALL then a group resends the group', async () => {
    const { dev, client, id } = setup('icd1', 185);
    await connect(client, id, dev.name);
    dev.commandLog.length = 0;
    client.setLra('A', 40);
    await tick(200);
    client.onLine('ERR ARG LRA'); // value not stored
    client.setLra('A', 40);
    await tick(200);
    client.setLra('ALL', 0);
    await tick(200);
    client.setLra('A', 40);
    await tick(200);
    client.setLra('A', 40); // duplicate
    await tick(200);
    expect(dev.commandLog.filter(c => c.startsWith('LRA'))).toEqual([
      'LRA 0 40',
      'LRA 0 40',
      'LRA BOTH 0',
      'LRA 0 40',
    ]);
    client.destroy();
  });
});
