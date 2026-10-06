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
  'info-cmd': 2000,
  setup: 3000,
  cleanup: 3000,
};

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
