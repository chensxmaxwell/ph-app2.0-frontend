/**
 * Command scheduler for the CMD characteristic.
 *
 * - Slider-style commands are keyed (e.g. "lra:A", "vcm"); only the latest
 *   value per key is kept and each key is sent at most once per
 *   `perKeyIntervalMs` (default 100 ms ≈ 10 Hz, PROTOCOL-ICD001 §5);
 *   `keyIntervalMs` overrides it per key (the client uses 200 ms for "vcm":
 *   fw 1.1.5 applies a new Hz only at the end of a full cycle, up to 1 s at
 *   1 Hz, §11.11, so a faster stream only adds BLE traffic). An `immediate`
 *   enqueue (e.g. `VHZ 0`) skips the per-key wait; the latest value always
 *   goes out (no value is lost, only intermediate ones).
 * - Globally at most one write per `minGapMs` (default 50 ms = 20 cmd/s cap).
 * - One write in flight at a time; each write carries exactly one command so a
 *   command is never split across BLE writes.
 * - `sendNow` (STOP / ESTOP) drops everything pending and goes out immediately.
 * - Optional per-key de-duplication (`enqueue(key, line, true)`): a line equal
 *   to the last one written for that key within `dedupeMs` is not written again
 *   (e.g. a slider release repeating the last streamed value). `sendNow`,
 *   `clear`, `forget` and a failed write reset it, so after STOP / ESTOP / ERR /
 *   disconnect the same value is always sent again. Safety lines never dedupe.
 */

export interface SchedulerClock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const defaultClock: SchedulerClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: h => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface SchedulerOptions {
  perKeyIntervalMs?: number;
  /** Per-key interval overrides (e.g. `{ vcm: 200 }`); others use perKeyIntervalMs. */
  keyIntervalMs?: Record<string, number>;
  minGapMs?: number;
  /** Window for per-key de-duplication (default 1000 ms). */
  dedupeMs?: number;
  clock?: SchedulerClock;
  onError?: (line: string, err: unknown) => void;
}

export type SendFn = (line: string, urgent: boolean) => Promise<void>;

export class CommandScheduler {
  private readonly perKey: number;
  private readonly keyInterval: Record<string, number>;
  /** Pending keys that skip their per-key interval (still respect minGap), e.g. `VHZ 0`. */
  private immediate = new Set<string>();
  private readonly minGap: number;
  private readonly dedupeMs: number;
  private readonly clock: SchedulerClock;
  private readonly onError?: (line: string, err: unknown) => void;

  /** key -> latest line, insertion order = fairness order. */
  private pending = new Map<string, string>();
  private lastKeySent = new Map<string, number>();
  /** key -> last line written (dedupe keys only), cleared by sendNow/clear/forget/error. */
  private lastLine = new Map<string, { line: string; at: number }>();
  private dedupeKeys = new Set<string>();
  private lastSent = -Infinity;
  private inFlight = false;
  private timer: unknown = null;

  constructor(private readonly send: SendFn, opts: SchedulerOptions = {}) {
    this.perKey = opts.perKeyIntervalMs ?? 100;
    this.keyInterval = { ...(opts.keyIntervalMs ?? {}) };
    this.minGap = opts.minGapMs ?? 50;
    this.dedupeMs = opts.dedupeMs ?? 1000;
    this.clock = opts.clock ?? defaultClock;
    this.onError = opts.onError;
  }

  /**
   * Queue a coalescable command. Replaces any not-yet-sent value for the key.
   * With `dedupe`, a line identical to the last one written for this key (and
   * not reset since, within `dedupeMs`) is dropped: the device already has it.
   */
  enqueue(key: string, line: string, dedupe = false, immediate = false): void {
    if (dedupe) {
      this.dedupeKeys.add(key);
      const last = this.lastLine.get(key);
      if (last && last.line === line && this.clock.now() - last.at < this.dedupeMs) {
        // latest intent == what was already written: drop any older pending value too
        this.pending.delete(key);
        this.immediate.delete(key);
        return;
      }
    } else {
      this.dedupeKeys.delete(key);
    }
    this.pending.set(key, line);
    if (immediate) {
      this.immediate.add(key);
    } else {
      this.immediate.delete(key);
    }
    if (immediate && this.timer !== null) {
      // re-plan: this key may be ready before the timer that is armed now
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    this.pump();
  }

  /** Interval for a key (override or default). */
  intervalFor(key: string): number {
    return this.keyInterval[key] ?? this.perKey;
  }

  /** Forget what was last written for these keys (all keys when none given). */
  forget(...keys: string[]): void {
    if (keys.length === 0) {
      this.lastLine.clear();
      return;
    }
    keys.forEach(k => this.lastLine.delete(k));
  }

  /** Safety path: clear pending and send right away (bypasses throttle and dedupe). */
  async sendNow(line: string): Promise<void> {
    this.clear();
    this.lastSent = this.clock.now();
    try {
      await this.send(line, true);
    } catch (e) {
      this.onError?.(line, e);
      throw e;
    }
  }

  /** Drop one pending key (e.g. an ALL supersedes single-group values). */
  drop(key: string): void {
    this.pending.delete(key);
    this.immediate.delete(key);
  }

  /** Drop all pending commands (disconnect, safety lock, leaving page). */
  clear(): void {
    this.pending.clear();
    this.immediate.clear();
    this.lastLine.clear();
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  private pump(): void {
    if (this.inFlight || this.timer !== null || this.pending.size === 0) {
      return;
    }
    const now = this.clock.now();
    let bestKey: string | null = null;
    let wait = Infinity;
    for (const key of this.pending.keys()) {
      const keyGap = this.immediate.has(key) ? 0 : this.intervalFor(key);
      const readyAt = Math.max((this.lastKeySent.get(key) ?? -Infinity) + keyGap, this.lastSent + this.minGap);
      const w = readyAt - now;
      if (w <= 0) {
        bestKey = key;
        wait = 0;
        break;
      }
      if (w < wait) {
        wait = w;
      }
    }
    if (bestKey === null) {
      this.timer = this.clock.setTimeout(() => {
        this.timer = null;
        this.pump();
      }, Math.max(1, Math.ceil(wait)));
      return;
    }
    const line = this.pending.get(bestKey) as string;
    this.pending.delete(bestKey);
    this.immediate.delete(bestKey);
    this.lastKeySent.set(bestKey, now);
    this.lastSent = now;
    if (this.dedupeKeys.has(bestKey)) {
      this.lastLine.set(bestKey, { line, at: now });
    }
    this.inFlight = true;
    const key = bestKey;
    this.send(line, false)
      .catch(e => {
        if (this.lastLine.get(key)?.line === line) {
          this.lastLine.delete(key);
        }
        this.onError?.(line, e);
      })
      .finally(() => {
        this.inFlight = false;
        this.pump();
      });
  }
}
