/**
 * Last Pulse speed (Hz), remembered by the app (PROTOCOL §10.7: the firmware
 * forgets the Hz after `VHZ 0`; audit F4). Keyed per device name (ICD1-XXXX /
 * H11-XXXX). A module-level cache keeps it across leaving / re-entering the
 * page within a session; an optional key-value storage (AsyncStorage in the
 * app, injected by useAdvancedControl) keeps it across app restarts.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface PulseSpeedStore {
  /** Cached value (sync); null when unknown this session. */
  get(device: string): number | null;
  /** Cached value, else storage; null when never set. */
  load(device: string): Promise<number | null>;
  /** Update the cache now; storage write is debounced (flush() forces it). */
  set(device: string, hz: number): void;
  flush(): void;
}

export const PULSE_SPEED_KEY_PREFIX = 'icd001.pulseHz.';
const WRITE_DEBOUNCE_MS = 400;

const cache = new Map<string, number>();

const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function createPulseSpeedStore(storage: KeyValueStorage | null = null): PulseSpeedStore {
  const dirty = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!storage) {
      dirty.clear();
      return;
    }
    dirty.forEach((hz, device) => {
      storage.setItem(PULSE_SPEED_KEY_PREFIX + device, String(hz)).catch(() => undefined);
    });
    dirty.clear();
  };
  return {
    get: device => cache.get(device) ?? null,
    async load(device) {
      const hit = cache.get(device);
      if (hit !== undefined || !storage) {
        return hit ?? null;
      }
      try {
        const raw = await storage.getItem(PULSE_SPEED_KEY_PREFIX + device);
        const n = raw === null ? NaN : Number(raw);
        if (!valid(n)) {
          return null;
        }
        // a value set while loading wins
        if (!cache.has(device)) {
          cache.set(device, n);
        }
        return cache.get(device) ?? null;
      } catch {
        return null;
      }
    },
    set(device, hz) {
      if (!valid(hz) || cache.get(device) === hz) {
        return;
      }
      cache.set(device, hz);
      dirty.set(device, hz);
      if (!timer) {
        timer = setTimeout(flush, WRITE_DEBOUNCE_MS);
      }
    },
    flush,
  };
}

/** In-memory only (default for the controller and tests). */
export const memoryPulseSpeedStore = createPulseSpeedStore(null);

/** Tests: forget everything cached this session. */
export function resetPulseSpeedCache(): void {
  cache.clear();
}
