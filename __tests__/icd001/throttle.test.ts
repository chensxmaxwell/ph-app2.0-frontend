import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { CommandScheduler } from '../../src/services/icd001/throttle';

describe('CommandScheduler', () => {
  let sent: Array<{ line: string; at: number; urgent: boolean }>;
  let sched: CommandScheduler;

  beforeEach(() => {
    jest.useFakeTimers({ now: 1_000_000 });
    sent = [];
    sched = new CommandScheduler(async (line, urgent) => {
      sent.push({ line, at: Date.now(), urgent });
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const flush = async (ms: number) => {
    for (let i = 0; i < ms; i += 5) {
      await jest.advanceTimersByTimeAsync(5);
    }
  };

  it('sends the first value immediately and coalesces a slider drag to ~10 Hz, last value wins', async () => {
    // ~60 Hz drag (60 events over ~1.2 s of fake time)
    const t0 = Date.now();
    for (let i = 0; i < 60; i++) {
      sched.enqueue('lra:A', `LRA 0 ${i}`);
      await flush(1000 / 60);
    }
    const dragMs = Date.now() - t0;
    await flush(300);
    const lines = sent.map(s => s.line);
    expect(lines[0]).toBe('LRA 0 0');
    expect(lines[lines.length - 1]).toBe('LRA 0 59');
    expect(lines.length).toBeGreaterThanOrEqual(9);
    expect(lines.length).toBeLessThanOrEqual(Math.ceil(dragMs / 100) + 1);
    for (let i = 1; i < sent.length; i++) {
      expect(sent[i].at - sent[i - 1].at).toBeGreaterThanOrEqual(100);
    }
  });

  it('caps total rate at 20 cmd/s across keys', async () => {
    for (let i = 0; i < 100; i++) {
      sched.enqueue('lra:A', `LRA 0 ${i}`);
      sched.enqueue('lra:B', `LRA 1 ${i}`);
      sched.enqueue('vcm', `VHZ ${10 + (i % 40)}`);
      await flush(10);
    }
    await flush(500);
    const windowCounts = new Map<number, number>();
    sent.forEach(s => {
      const w = Math.floor((s.at - 1_000_000) / 1000);
      windowCounts.set(w, (windowCounts.get(w) ?? 0) + 1);
    });
    windowCounts.forEach(c => expect(c).toBeLessThanOrEqual(20));
    for (let i = 1; i < sent.length; i++) {
      expect(sent[i].at - sent[i - 1].at).toBeGreaterThanOrEqual(50);
    }
    expect(sent.filter(s => s.line.startsWith('LRA 0')).pop()!.line).toBe('LRA 0 99');
  });

  it('sendNow bypasses throttle and drops pending slider values', async () => {
    sched.enqueue('lra:A', 'LRA 0 10');
    sched.enqueue('lra:A', 'LRA 0 80'); // pending
    await sched.sendNow('STOP');
    await flush(500);
    expect(sent.map(s => s.line)).toEqual(['LRA 0 10', 'STOP']);
    expect(sent[1].urgent).toBe(true);
    expect(sched.pendingCount).toBe(0);
  });

  it('clear() cancels pending timer', async () => {
    sched.enqueue('vcm', 'VHZ 10');
    sched.enqueue('vcm', 'VHZ 20');
    sched.clear();
    await flush(500);
    expect(sent.map(s => s.line)).toEqual(['VHZ 10']);
  });

  it('keeps going after a failed write', async () => {
    let fail = true;
    const errs: string[] = [];
    const s2 = new CommandScheduler(
      async line => {
        if (fail) {
          fail = false;
          throw new Error('gatt busy');
        }
        sent.push({ line, at: Date.now(), urgent: false });
      },
      { onError: line => errs.push(line) },
    );
    s2.enqueue('a', 'LRA 0 1');
    s2.enqueue('b', 'LRA 1 2');
    await flush(300);
    expect(errs).toEqual(['LRA 0 1']);
    expect(sent.map(s => s.line)).toEqual(['LRA 1 2']);
  });
  it('dedupe keys: an identical line already written is not re-sent; a different one is (audit F10)', async () => {
    sched.enqueue('wing:B', 'LRA 1 20', true);
    await flush(150);
    sched.enqueue('wing:B', 'LRA 1 30', true);
    await flush(150);
    sched.enqueue('wing:B', 'LRA 1 30', true); // slider release repeats the last value
    await flush(300);
    expect(sent.map(x => x.line)).toEqual(['LRA 1 20', 'LRA 1 30']);
    // a pending value superseded by "back to what was just written" is dropped too
    sched.enqueue('wing:B', 'LRA 1 40', true);
    await flush(5); // written; key now inside its 100 ms window
    sched.enqueue('wing:B', 'LRA 1 45', true); // pending
    sched.enqueue('wing:B', 'LRA 1 40', true); // back to 40 -> pending 45 dropped
    await flush(300);
    expect(sent.map(x => x.line)).toEqual(['LRA 1 20', 'LRA 1 30', 'LRA 1 40']);
    // keys without dedupe keep the old behaviour
    sched.enqueue('get', 'GET');
    await flush(150);
    sched.enqueue('get', 'GET');
    await flush(150);
    expect(sent.filter(x => x.line === 'GET')).toHaveLength(2);
  });

  it('dedupe is reset by sendNow (STOP/ESTOP), clear, forget, a failed write and after the window', async () => {
    const again = async (reset: () => void | Promise<void>) => {
      sched.enqueue('vcm', 'VHZ 24', true);
      await flush(150);
      await reset();
      const n = sent.length;
      sched.enqueue('vcm', 'VHZ 24', true);
      await flush(150);
      return sent.slice(n).map(x => x.line);
    };
    expect(await again(() => sched.sendNow('STOP'))).toEqual(['VHZ 24']);
    expect(await again(() => sched.clear())).toEqual(['VHZ 24']);
    expect(await again(() => sched.forget('vcm'))).toEqual(['VHZ 24']);
    expect(await again(() => sched.forget())).toEqual(['VHZ 24']);
    expect(await again(() => flush(1100))).toEqual(['VHZ 24']);
    expect(await again(() => undefined)).toEqual([]);
    // safety lines are never deduped or throttled
    const n = sent.length;
    await sched.sendNow('ESTOP 1');
    await sched.sendNow('ESTOP 1');
    expect(sent.slice(n).map(x => [x.line, x.urgent])).toEqual([
      ['ESTOP 1', true],
      ['ESTOP 1', true],
    ]);
  });

  it('a failed write is not remembered for dedupe', async () => {
    let fail = true;
    const lines: string[] = [];
    const s2 = new CommandScheduler(async line => {
      lines.push(line);
      if (fail) {
        fail = false;
        throw new Error('ble');
      }
    });
    s2.enqueue('wing:A', 'LRA 0 40', true);
    await flush(150);
    s2.enqueue('wing:A', 'LRA 0 40', true);
    await flush(150);
    expect(lines).toEqual(['LRA 0 40', 'LRA 0 40']);
  });
});
