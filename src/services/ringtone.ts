import { nativePlayAudio, nativeStopSpeaking } from "../native/ph-native";
import { bytesToBase64 } from "./bytes";

/**
 * The ring-back a call plays before the companion picks up (Maxwell,
 * TestFlight 1.2 (19): a call has to ring like a phone call, WeChat-style,
 * before the greeting — and, his follow-up, for a length drawn fresh on
 * every connect, uniformly between 2 and 5 seconds, the way a person picks
 * up when they pick up).
 *
 * The tone is synthesized here, to exactly the drawn length — the classic
 * dual ring-back, 440 + 480 Hz, a public signalling standard, on a 1 s on /
 * 0.6 s off cadence, faded out where the pick-up lands so it never clicks.
 * No ringtone file is bundled and nothing is borrowed from WeChat. It is
 * played through PHNative's AVAudioPlayer path (`playAudio`), which moves
 * AVAudioSession to Playback first, so it sounds through the speaker with
 * the ring/silent switch on and stops through the same `stopSpeaking` the
 * call already uses.
 *
 * One helper for every call surface: Message and Love ring through
 * `startRingback` today; Sync can ring and cancel the same way.
 */

// The draw: uniform, whole milliseconds, both ends included.
export const RINGBACK_MIN_MS = 2000;
export const RINGBACK_MAX_MS = 5000;
// A player that never reports back must not hold the call: this far past
// the drawn length the ring is over whatever the player says.
export const RINGBACK_GRACE_MS = 2000;
export const RINGBACK_SAMPLE_RATE = 16000;
export const RINGBACK_TONES_HZ: readonly number[] = [440, 480];
// Peak amplitude, full scale 1.0: a ring-back sits well under the voice.
export const RINGBACK_GAIN = 0.35;
// Each burst eases in and out so it never clicks — including the burst the
// pick-up cuts short.
export const RINGBACK_FADE_MS = 15;
// The cadence: a ring, a pause, a ring, … until the call is answered.
export const RINGBACK_BURST_MS = 1000;
export const RINGBACK_GAP_MS = 600;

// How long this connect rings. `random` is Math.random unless a test hands
// in its own.
export const pickRingbackDuration = (
  random: () => number = Math.random
): number =>
  Math.round(RINGBACK_MIN_MS + random() * (RINGBACK_MAX_MS - RINGBACK_MIN_MS));

const WAV_HEADER_BYTES = 44;

const writeAscii = (bytes: Uint8Array, at: number, text: string) => {
  for (let index = 0; index < text.length; index += 1) {
    bytes[at + index] = text.charCodeAt(index);
  }
};

const toSamples = (ms: number) =>
  Math.round((ms / 1000) * RINGBACK_SAMPLE_RATE);

// A ring of `durationMs` as a 16-bit mono PCM WAV: bursts on the cadence
// from the first sample, the last one cut — and faded — where the call is
// picked up.
export const ringbackWav = (durationMs: number): Uint8Array => {
  const total = toSamples(durationMs);
  const dataBytes = total * 2;
  const bytes = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RINGBACK_SAMPLE_RATE, true);
  view.setUint32(28, RINGBACK_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, dataBytes, true);

  const fade = Math.max(1, toSamples(RINGBACK_FADE_MS));
  const burst = toSamples(RINGBACK_BURST_MS);
  const period = burst + toSamples(RINGBACK_GAP_MS);
  const perTone = RINGBACK_GAIN / RINGBACK_TONES_HZ.length;
  for (let start = 0; start < total; start += period) {
    const count = Math.min(burst, total - start);
    for (let index = 0; index < count; index += 1) {
      const envelope = Math.max(
        0,
        Math.min(1, index / fade, (count - 1 - index) / fade)
      );
      const t = (start + index) / RINGBACK_SAMPLE_RATE;
      let value = 0;
      RINGBACK_TONES_HZ.forEach((hz) => {
        value += Math.sin(2 * Math.PI * hz * t);
      });
      view.setInt16(
        WAV_HEADER_BYTES + (start + index) * 2,
        Math.round(value * perTone * envelope * 32767),
        true
      );
    }
  }
  return bytes;
};

// Every connect draws its own length, so the tone is made for the call at
// hand (a few ms of arithmetic) rather than kept. Base64 because that is
// what PHNative's player takes (bytes.ts; RN has no Buffer / btoa).
export const ringbackWavBase64 = (durationMs: number): string =>
  bytesToBase64(ringbackWav(durationMs));

// How a ring ended: the tone played through, the tone could not be played
// and the line was held for its length instead, or the caller cancelled.
export type RingbackEnd = "played" | "silent" | "cancelled";

export type Ringback = {
  // How long this ring lasts (the draw, or what the caller fixed).
  durationMs: number;
  finished: Promise<RingbackEnd>;
  // Stops the tone at once. Idempotent; nothing after the ring is over.
  cancel: () => void;
};

const swallow = () => undefined;

// The ring is decoration: nothing about it may take a call down, not even a
// native surface that lacks the player (an older binary, a test's mock).
const playTone = (durationMs: number): Promise<boolean> => {
  try {
    return Promise.resolve(
      nativePlayAudio([ringbackWavBase64(durationMs)])
    ).then(
      (played) => played === true,
      () => false
    );
  } catch {
    return Promise.resolve(false);
  }
};

const stopTone = () => {
  try {
    Promise.resolve(nativeStopSpeaking()).catch(swallow);
  } catch {
    // Nothing to stop with; nothing is playing either.
  }
};

// Rings for `durationMs` — a fresh 2–5 s draw unless the caller fixes it.
// `finished` settles when the caller may go on (pick up); `cancel` (hang-up,
// minimize) silences the tone and settles it as cancelled. A player that
// cannot play still holds the line for the same length, so the call rings —
// silently — for the same beat everywhere.
export const startRingback = ({
  durationMs = pickRingbackDuration(),
}: { durationMs?: number } = {}): Ringback => {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveEnd: (end: RingbackEnd) => void = () => undefined;
  const finished = new Promise<RingbackEnd>((resolve) => {
    resolveEnd = resolve;
  });
  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const end = (why: RingbackEnd) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimer();
    resolveEnd(why);
  };
  const startedAt = Date.now();
  const holdTheLine = () => {
    if (settled) {
      return;
    }
    clearTimer();
    const remaining = Math.max(0, durationMs - (Date.now() - startedAt));
    timer = setTimeout(() => end("silent"), remaining);
  };
  timer = setTimeout(() => {
    if (settled) {
      return;
    }
    stopTone();
    end("silent");
  }, durationMs + RINGBACK_GRACE_MS);
  playTone(durationMs).then((played) => {
    if (settled) {
      return;
    }
    if (played) {
      end("played");
      return;
    }
    holdTheLine();
  });
  return {
    durationMs,
    finished,
    cancel: () => {
      if (settled) {
        return;
      }
      stopTone();
      end("cancelled");
    },
  };
};
