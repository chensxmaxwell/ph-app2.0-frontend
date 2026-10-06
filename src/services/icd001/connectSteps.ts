/**
 * Connect steps, per-step timeouts and failure kinds (TF 1.2 (27) "Connecting"
 * forever: an iOS connect has no timeout of its own, so every native step is
 * bounded here and the whole connect is capped at CONNECT_TIMEOUT_MS).
 */

export type ConnectStep =
  | 'bluetooth' // BleManager started once + powered on
  | 'link' // BleManager.connect
  | 'mtu'
  | 'services' // retrieveServices + ICD-001 service / characteristics present
  | 'notify' // TLM notifications on
  | 'info' // INFO characteristic read
  | 'info-cmd' // INFO command (full caps / no characteristic)
  | 'setup' // RATE / HB / MODE writes
  | 'cleanup';

/** Whole connect, first byte to `connected`. */
export const CONNECT_TIMEOUT_MS = 15_000;

/** Upper bound per step (also never past the overall deadline). */
export const STEP_TIMEOUT_MS: Record<ConnectStep, number> = {
  bluetooth: 4000,
  link: 10_000,
  mtu: 3000,
  services: 5000,
  notify: 5000,
  info: 3000,
  'info-cmd': 2000, // floor; the real limit is infoCmdTimeoutMs(mtu)
  setup: 3000,
  cleanup: 3000,
};

/**
 * Longest `INFO` command reply on the wire: fw `char j[1100]` (incl. NUL) +
 * `\n` = 1100 B (h11-icd-v1 1.1.2 sends ~874 B, §11.9.2). It comes back as
 * one line split into MTU-3 byte notifications on the TLM characteristic.
 */
export const INFO_REPLY_MAX_BYTES = 1100;
/** Pessimistic radio pace: one notification per 50 ms connection event. */
const NOTIFY_WORST_MS = 50;
const INFO_CMD_CEILING_MS = 5000;

/**
 * INFO command timeout for a link MTU. iOS reports 23 (ble-manager cannot read
 * the negotiated MTU), so iOS always gets the MTU-23 budget: 55 packets ->
 * 1 s + 55 x 50 ms = 3.75 s. MTU >= 185 stays at the 2 s floor.
 */
export function infoCmdTimeoutMs(mtu: number | null | undefined): number {
  const payload = mtu && mtu > 23 ? mtu - 3 : 20;
  const packets = Math.ceil(INFO_REPLY_MAX_BYTES / payload);
  return Math.min(
    INFO_CMD_CEILING_MS,
    Math.max(STEP_TIMEOUT_MS['info-cmd'], 1000 + packets * NOTIFY_WORST_MS),
  );
}

export type ConnectFailureKind = 'timeout' | 'unsupported' | 'bluetooth' | 'failed';

export class ConnectStepError extends Error {
  constructor(readonly step: ConnectStep, readonly kind: ConnectFailureKind, message: string) {
    super(message);
    this.name = 'ConnectStepError';
  }
}

/** Rejects with a ConnectStepError(step, 'timeout') after `ms`; the late result is dropped. */
export function withTimeout<T>(p: Promise<T>, ms: number, step: ConnectStep): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () =>
        reject(new ConnectStepError(step, 'timeout', `${step}: no answer in ${Math.round(ms / 100) / 10} s`)),
      ms,
    );
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export interface ConnectFailure {
  kind: ConnectFailureKind;
  step: ConnectStep;
  /** Two-line notice (design v4: title + one line). */
  title: string;
  line: string;
  /** Raw reason, for the debug screen. */
  detail: string;
  at: number;
}

export function connectFailureFor(
  step: ConnectStep,
  kind: ConnectFailureKind,
  detail: string,
): ConnectFailure {
  const at = Date.now();
  switch (kind) {
    case 'unsupported':
      return {
        kind,
        step,
        title: 'Firmware update needed',
        line: 'This device needs a firmware update.',
        detail,
        at,
      };
    case 'bluetooth':
      return {
        kind,
        step,
        title: 'Bluetooth is off',
        line: 'Turn on Bluetooth, then tap Retry.',
        detail,
        at,
      };
    case 'timeout':
      return {
        kind,
        step,
        title: "Couldn't connect",
        line: 'No answer. Keep it close, tap Retry.',
        detail,
        at,
      };
    default:
      return { kind, step, title: "Couldn't connect", line: 'Keep it close, then tap Retry.', detail, at };
  }
}

/** Classify any error thrown during a step. */
export function toStepError(e: unknown, step: ConnectStep): ConnectStepError {
  if (e instanceof ConnectStepError) {
    return e;
  }
  return new ConnectStepError(step, 'failed', e instanceof Error ? e.message : String(e));
}
