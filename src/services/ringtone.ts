import { playAudioWithNative, stopNativeTts } from "./voice-input";

/**
 * The ring-back heard before a companion picks up: a few seconds of ringing,
 * then the greeting (Maxwell: a WeChat-style ring before Sync and calls
 * connect). The tone is our own — a dual tone of 440 + 480 Hz in a short
 * two-burst cadence, synthesized here as a small mono PCM WAV and played
 * through PHNative's AVAudioPlayer (`playAudio`, the cloud voice's player,
 * which also moves the audio session to Playback first; landmine 22). No
 * ringtone file is bundled and nothing is borrowed from any app's audio.
 *
 * `playRingback` owns the ring's length: `done` settles when the ring is
 * over or `stop()` is called, and either way the player is stopped so no
 * tail ever plays under the greeting. A build without the native player
 * (Android, an old IPA) rings silently for the same length, so the
 * connecting phase feels the same everywhere.
 */

// About four seconds, and never a blink or a wait: the length is clamped.
export const RING_MIN_MS = 3000;
export const RING_MAX_MS = 5000;
export const RING_DURATION_MS = 4000;

export const clampRingDuration = (ms: number): number =>
  Math.min(RING_MAX_MS, Math.max(RING_MIN_MS, Math.round(ms)));

// The two partials of the tone (the classic ring-back pair).
export const RINGBACK_TONE_HZ = [440, 480] as const;
// One ring: burst, gap, burst, pause — repeated for the length of the ring.
// Two seconds a cycle, so a four-second ring is two rings closing on silence.
export const RING_CADENCE_MS = [400, 200, 400, 1000] as const;
export const RING_SAMPLE_RATE = 8000;
// Of full scale: clearly audible, never harsh next to the voice.
const RING_AMPLITUDE = 0.35;
// Attack / release on every burst so it never clicks.
const RING_RAMP_MS = 15;

const CYCLE_MS = RING_CADENCE_MS.reduce((sum, part) => sum + part, 0);

// The burst envelope at a moment of the ring: 0 in a gap, 1 in a burst, on a
// ramp at either edge of one.
const envelopeAt = (ms: number): number => {
  const inCycle = ms % CYCLE_MS;
  let edge = 0;
  for (let index = 0; index < RING_CADENCE_MS.length; index += 1) {
    const part = RING_CADENCE_MS[index];
    const on = index % 2 === 0;
    if (inCycle < edge + part) {
      if (!on) {
        return 0;
      }
      const into = inCycle - edge;
      const left = edge + part - inCycle;
      return Math.min(1, into / RING_RAMP_MS, left / RING_RAMP_MS);
    }
    edge += part;
  }
  return 0;
};

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const toBase64 = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    parts.push(
      BASE64[(triple >> 18) & 63],
      BASE64[(triple >> 12) & 63],
      index + 1 < bytes.length ? BASE64[(triple >> 6) & 63] : "=",
      index + 2 < bytes.length ? BASE64[triple & 63] : "="
    );
  }
  return parts.join("");
};

const writeAscii = (view: DataView, offset: number, text: string) => {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
};

const wavCache = new Map<number, string>();

// The ring as a base64 RIFF/WAVE blob: 8 kHz, mono, 16-bit PCM, exactly the
// (clamped) length asked for. Deterministic, built once per length.
export const ringbackToneWav = (durationMs: number = RING_DURATION_MS): string => {
  const length = clampRingDuration(durationMs);
  const cached = wavCache.get(length);
  if (cached) {
    return cached;
  }
  const frames = Math.round((length / 1000) * RING_SAMPLE_RATE);
  const dataBytes = frames * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RING_SAMPLE_RATE, true);
  view.setUint32(28, RING_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  const [low, high] = RINGBACK_TONE_HZ;
  for (let frame = 0; frame < frames; frame += 1) {
    const seconds = frame / RING_SAMPLE_RATE;
    const gain = envelopeAt(seconds * 1000);
    const tone =
      gain === 0
        ? 0
        : (Math.sin(2 * Math.PI * low * seconds) +
            Math.sin(2 * Math.PI * high * seconds)) /
          2;
    view.setInt16(
      44 + frame * 2,
      Math.round(gain * RING_AMPLITUDE * tone * 32767),
      true
    );
  }
  const wav = toBase64(new Uint8Array(buffer));
  wavCache.set(length, wav);
  return wav;
};

export type Ringback = {
  // The clamped length the ring actually runs for.
  durationMs: number;
  // Settles when the ring is over or has been stopped.
  done: Promise<void>;
  // Silence the ring now (hang-up, minimize). Idempotent.
  stop: () => void;
};

const swallow = () => undefined;

export const playRingback = ({
  durationMs = RING_DURATION_MS,
}: { durationMs?: number } = {}): Ringback => {
  const length = clampRingDuration(durationMs);
  let settled = false;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    stopNativeTts().catch(swallow);
    resolveDone();
  };
  const timer = setTimeout(finish, length);
  Promise.resolve(playAudioWithNative([ringbackToneWav(length)])).catch(swallow);
  return { durationMs: length, done, stop: finish };
};
