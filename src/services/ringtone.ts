import { playAudioWithNative, stopNativeTts } from "./voice-input";

/**
 * The ring-back heard before a companion picks up: a few seconds of ringing,
 * then the greeting (Maxwell: a WeChat-style ring before Sync and calls
 * connect, a different length every time — anywhere from two to five
 * seconds). The tone is our own — a dual tone of 440 + 480 Hz in a short
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

// Two to five seconds, bounds included; every length is clamped into it.
export const RING_MIN_MS = 2000;
export const RING_MAX_MS = 5000;

export const clampRingDuration = (ms: number): number =>
  Math.min(RING_MAX_MS, Math.max(RING_MIN_MS, Math.round(ms)));

// One ring's length: drawn uniformly over the whole range, to the
// millisecond, so no two rings feel the same. `random` is Math.random unless
// a test wants the draw pinned.
export const drawRingDuration = (random: () => number = Math.random): number =>
  clampRingDuration(RING_MIN_MS + random() * (RING_MAX_MS - RING_MIN_MS));

// The two partials of the tone (the classic ring-back pair).
export const RINGBACK_TONE_HZ = [440, 480] as const;
// One ring: burst, gap, burst, pause — repeated for the length of the ring.
// Two seconds a cycle, so a four-second ring is two rings closing on silence.
export const RING_CADENCE_MS = [400, 200, 400, 1000] as const;
export const RING_SAMPLE_RATE = 8000;
// Of full scale: clearly audible, never harsh next to the voice.
const RING_AMPLITUDE = 0.35;
// Attack / release on every burst — and on the very end of the ring, which
// can fall inside a burst — so it never clicks.
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

// The last tone built, for the one length that repeats (a test's, a pinned
// draw's); ring lengths vary to the millisecond, so nothing larger would
// ever hit and would only grow.
let lastWav: { length: number; wav: string } | null = null;

// The ring as a base64 RIFF/WAVE blob: 8 kHz, mono, 16-bit PCM, exactly the
// (clamped) length asked for, fading out over its last RING_RAMP_MS.
// Deterministic for a length; a few milliseconds to build.
export const ringbackToneWav = (durationMs: number): string => {
  const length = clampRingDuration(durationMs);
  if (lastWav?.length === length) {
    return lastWav.wav;
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
    const ms = seconds * 1000;
    const gain = Math.min(envelopeAt(ms), (length - ms) / RING_RAMP_MS);
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
  lastWav = { length, wav };
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

// Ring for `durationMs` (clamped), or for a fresh draw when none is given.
export const playRingback = ({
  durationMs,
}: { durationMs?: number } = {}): Ringback => {
  const length =
    durationMs === undefined ? drawRingDuration() : clampRingDuration(durationMs);
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
