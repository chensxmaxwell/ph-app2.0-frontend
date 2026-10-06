/**
 * h11-icd-v1 1.1.1 / 1.1.2 (PROTOCOL-ICD001 §11.9, §11.9.2): bigger INFO command
 * reply (auto.hrValid + hrValid.fast, 874 B, fw buffer 1100 B) and FAST-stage
 * telemetry (hr 0 with lra 40, format unchanged).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { INFO_1100, INFO_874, byteLen, fw112FastTlm, paddedInfo } from '../../jest/icd001-fw112-info';
import { AdvancedControlController, IntensityView } from '../../src/screens/advanced-control/controller';
import { autoSensors, sensorBanner } from '../../src/screens/advanced-control/model';
import { resetPulseSpeedCache } from '../../src/screens/advanced-control/pulseMemory';
import { Icd001Client } from '../../src/services/icd001/client';
import {
  INFO_REPLY_MAX_BYTES,
  STEP_TIMEOUT_MS,
  infoCmdTimeoutMs,
} from '../../src/services/icd001/connectSteps';
import { MockIcd001Device, MockIcd001Transport } from '../../src/services/icd001/mock';
import {
  LineAssembler,
  parseInfo,
  parseLine,
  parseTelemetry,
  supportsAuto,
} from '../../src/services/icd001/protocol';
import { encodeUtf8 } from '../../src/services/icd001/utf8';

const tick = async (ms: number) => {
  for (let i = 0; i < ms; i += 10) {
    await jest.advanceTimersByTimeAsync(10);
  }
};

/** Notifications for one `\n`-terminated line at a given MTU (fw bleSendLine). */
const packets = (jsonBytes: number, mtu: number) => Math.ceil((jsonBytes + 1) / (mtu > 23 ? mtu - 3 : 20));

const FIXTURES: Array<[string, string]> = [
  ['874 B (fw 1.1.2)', INFO_874],
  ['1100 B (buffer max + 1)', INFO_1100],
];

describe('INFO JSON with fw 1.1.1 / 1.1.2 keys', () => {
  it('fixtures are the sizes hardware quoted', () => {
    expect(byteLen(INFO_874)).toBe(874);
    expect(byteLen(INFO_1100)).toBe(1100);
    expect(INFO_REPLY_MAX_BYTES).toBe(1100);
  });

  it.each(FIXTURES)(
    '%s: unknown keys (auto.hrValid, hrValid.fast, extra top-level) are ignored',
    (_n, json) => {
      const info = parseInfo(json)!;
      expect(info).not.toBeNull();
      expect(info.proto).toBe('ICD001-1');
      expect(info.fw).toBe('1.1.2');
      expect(supportsAuto(info)).toBe(true);
      expect(info.auto).toMatchObject({
        detail: true,
        boot: 'auto',
        lraNoHr: 0, // §11.9.4: 25 -> 0 in 1.1.1
        fsr: ['J19', 'J20'],
        lraSrc: { A: 0, B: 2 },
        hbMaxS: 30,
        vhz: { min: 5, max: 10 },
        hr: { lo: 60, hi: 120 },
      });
      expect(info.modules.wings!.groups.map(g => g.label)).toEqual(['上翼', '下翼']);
      expect(info.safety.fromInfo).toEqual({ ot: true, lb: true });
      // kept verbatim in raw for the debug screen
      expect((info.raw.ch as any).auto.hrValid.fast).toMatchObject({ lra: 40, confirmMs: 8000 });
    },
  );

  it.each(FIXTURES)(
    '%s: a reply line is INFO, not telemetry (the nested "lra" is not top level)',
    (_n, json) => {
      const p = parseLine(json);
      expect(p.kind).toBe('info');
    },
  );
});

describe('INFO command reassembly (one line, MTU-3 byte notifications)', () => {
  it('packet counts and timeout budget at MTU 23 (worst case) vs 185 / 247', () => {
    expect(packets(874, 23)).toBe(44);
    expect(packets(1099, 23)).toBe(55); // largest the fw can send: 1099 + \n
    expect(packets(1100, 23)).toBe(56);
    expect(packets(874, 185)).toBe(5);
    expect(packets(874, 247)).toBe(4);
    // 1 s + 55 packets x 50 ms (one notification per 50 ms connection event)
    expect(infoCmdTimeoutMs(23)).toBe(3750);
    expect(infoCmdTimeoutMs(null)).toBe(3750);
    expect(infoCmdTimeoutMs(185)).toBe(STEP_TIMEOUT_MS['info-cmd']);
    expect(infoCmdTimeoutMs(247)).toBe(2000);
    // the old flat 2 s would not cover 55 packets at one per 50 ms
    expect(55 * 50).toBeGreaterThan(2000);
  });

  it.each(FIXTURES)('%s: reassembled at 20 B and 182 B chunks, UTF-8 split across packets', (_n, json) => {
    for (const chunk of [20, 182, 244]) {
      const a = new LineAssembler();
      const bytes = encodeUtf8(`${json}\n`);
      const out: string[] = [];
      for (let i = 0; i < bytes.length; i += chunk) {
        out.push(...a.push(bytes.slice(i, i + chunk)));
      }
      expect(out).toEqual([json]);
      expect(a.pendingBytes).toBe(0);
    }
  });

  it('no line cap below 4096 B (2000 B line still whole)', () => {
    const a = new LineAssembler();
    const big = paddedInfo(2000);
    const bytes = encodeUtf8(`${big}\n`);
    const out: string[] = [];
    for (let i = 0; i < bytes.length; i += 20) {
      out.push(...a.push(bytes.slice(i, i + 20)));
    }
    expect(out).toEqual([big]);
  });
});

describe('connect to fw 1.1.2 at MTU 23 (client + simulator)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 20_000_000 });
    resetPulseSpeedCache();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const run = async (json: string, notifyPacketMs: number, tlmHz: number) => {
    const dev = new MockIcd001Device('icd1v1', 'ICD1-F112');
    dev.fullInfoOverride = json;
    dev.rate = tlmHz;
    const transport = new MockIcd001Transport([dev], { mtu: 23, connectDelayMs: 10, notifyPacketMs });
    const client = new Icd001Client(transport, { reconnectDelaysMs: [100, 100] });
    const started = Date.now();
    let infoAt: number | null = null;
    let detailWhenConnected: boolean | null = null;
    const off = client.subscribe(s => {
      if (infoAt === null && s.info?.auto?.detail) {
        infoAt = Date.now();
      }
      if (detailWhenConnected === null && s.status === 'connected') {
        detailWhenConnected = !!s.info?.auto?.detail;
      }
    });
    const p = client.connect({
      id: 'sim-ICD1-F112',
      name: 'ICD1-F112',
      rssi: -50,
      kind: null,
      simulated: true,
    });
    await tick(6000);
    const ok = await p;
    const s = client.getState();
    off();
    client.destroy();
    return { ok, s, infoMs: infoAt === null ? null : infoAt - started, detailWhenConnected };
  };

  it.each(FIXTURES)(
    '%s at one notification per 50 ms (pessimistic radio), TLM quiet: full INFO arrives after > 2 s and is used',
    async (_n, json) => {
      const r = await run(json, 50, 0);
      expect(r.ok).toBe(true);
      expect(r.s.status).toBe('connected');
      expect(r.s.mtu).toBe(23);
      expect(r.s.info!.fw).toBe('1.1.2');
      expect(r.s.info!.auto).toMatchObject({ detail: true, lraNoHr: 0, hbMaxS: 30 });
      expect(r.infoMs).toBeGreaterThan(2000); // would have timed out with the old 2 s
      expect(r.infoMs).toBeLessThan(infoCmdTimeoutMs(23) + 1000);
      // used by the connect itself (HB / sensors caps), not patched in by a late line
      expect(r.detailWhenConnected).toBe(true);
      expect(r.s.connectLog.join('\n')).not.toMatch(/info-cmd: no reply/);
    },
  );

  it.each(FIXTURES)(
    '%s at 10 ms per notification with the fw default 5 Hz TLM sharing the link',
    async (_n, json) => {
      const r = await run(json, 10, 5);
      expect(r.ok).toBe(true);
      expect(r.s.info!.auto!.detail).toBe(true);
      expect(r.s.info!.fw).toBe('1.1.2');
      expect(r.detailWhenConnected).toBe(true);
    },
  );
});

describe('fw 1.1.2 FAST stage in Auto: hr 0 with lra 40 (§11.9.2 item 2)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 20_000_000 });
    resetPulseSpeedCache();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('telemetry parses: contact on, HR null (unconfirmed), LRA 40', () => {
    const t = parseTelemetry(JSON.parse(fw112FastTlm()));
    expect(t.lra).toEqual([40, 0]);
    expect(t.ppg[0]).toMatchObject({ contact: true, hr: null });
    expect(t.ppg[2]).toMatchObject({ contact: true, hr: null });
    expect(t.src).toEqual({ fsr: [true, true], ppg: [true, true, true] });
  });

  it('no sensor notice, wings show the actual 40 % output, sensors row ok', async () => {
    const dev = new MockIcd001Device('icd1v1', 'ICD1-F112');
    dev.fullInfoOverride = INFO_874;
    dev.rate = 0; // only the injected frames below
    const transport = new MockIcd001Transport([dev], { mtu: 185, connectDelayMs: 10 });
    const client = new Icd001Client(transport, { reconnectDelaysMs: [100, 100] });
    const ctl = new AdvancedControlController(client);
    ctl.start();
    const p = client.connect({
      id: 'sim-ICD1-F112',
      name: 'ICD1-F112',
      rssi: -50,
      kind: null,
      simulated: true,
    });
    await tick(400);
    expect(await p).toBe(true);
    for (const lra of [
      [40, 0],
      [40, 40],
    ] as Array<[number, number]>) {
      client.onLine(fw112FastTlm(lra));
      const v = ctl.getView();
      const s = client.getState();
      expect(s.mode).toBe('auto');
      expect(v.banner).toBeNull();
      expect(sensorBanner(autoSensors(s.tlm, s.info))).toBeNull();
      expect(v.mode.sensors).toEqual({ pressure: 'ok', upper: 'ok', lower: 'ok', overall: 'ok' });
      const wing = v.cards.find(c => c.kind === 'intensity') as IntensityView;
      expect(wing.readOnly).toBe(true);
      expect(wing.values).toEqual({ A: lra[0], B: lra[1] });
    }
    ctl.dispose();
    client.destroy();
  });
});
