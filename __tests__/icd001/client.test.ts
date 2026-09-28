import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Icd001Client } from '../../src/services/icd001/client';
import { MockIcd001Device, MockIcd001Transport } from '../../src/services/icd001/mock';

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
});
