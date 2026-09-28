/**
 * Command scheduler for the CMD characteristic.
 *
 * - Slider-style commands are keyed (e.g. "lra:A", "vcm"); only the latest
 *   value per key is kept and each key is sent at most once per
 *   `perKeyIntervalMs` (default 100 ms ≈ 10 Hz, PROTOCOL-ICD001 §5).
 * - Globally at most one write per `minGapMs` (default 50 ms = 20 cmd/s cap).
 * - One write in flight at a time; each write carries exactly one command so a
 *   command is never split across BLE writes.
 * - `sendNow` (STOP / ESTOP) drops everything pending and goes out immediately.
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
  minGapMs?: number;
  clock?: SchedulerClock;
  onError?: (line: string, err: unknown) => void;
}

export type SendFn = (line: string, urgent: boolean) => Promise<void>;

export class CommandScheduler {
  private readonly perKey: number;
  private readonly minGap: number;
  private readonly clock: SchedulerClock;
  private readonly onError?: (line: string, err: unknown) => void;

  /** key -> latest line, insertion order = fairness order. */
  private pending = new Map<string, string>();
  private lastKeySent = new Map<string, number>();
  private lastSent = -Infinity;
  private inFlight = false;
  private timer: unknown = null;

  constructor(private readonly send: SendFn, opts: SchedulerOptions = {}) {
    this.perKey = opts.perKeyIntervalMs ?? 100;
    this.minGap = opts.minGapMs ?? 50;
    this.clock = opts.clock ?? defaultClock;
    this.onError = opts.onError;
  }

  /** Queue a coalescable command. Replaces any not-yet-sent value for the key. */
  enqueue(key: string, line: string): void {
    this.pending.set(key, line);
    this.pump();
  }

  /** Safety path: clear pending and send right away (bypasses throttle). */
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
  }

  /** Drop all pending commands (disconnect, safety lock, leaving page). */
  clear(): void {
    this.pending.clear();
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
      const readyAt = Math.max(
        (this.lastKeySent.get(key) ?? -Infinity) + this.perKey,
        this.lastSent + this.minGap,
      );
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
    this.lastKeySent.set(bestKey, now);
    this.lastSent = now;
    this.inFlight = true;
    this.send(line, false)
      .catch(e => this.onError?.(line, e))
      .finally(() => {
        this.inFlight = false;
        this.pump();
      });
  }
}
