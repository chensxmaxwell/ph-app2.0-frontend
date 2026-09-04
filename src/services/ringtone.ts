import { nativePlayAudio, nativeStopSpeaking } from "../native/ph-native";

/**
 * The ring-back a call plays before the companion picks up (Maxwell,
 * TestFlight 1.2 (19): a call has to ring like a phone call, WeChat-style,
 * for a few seconds before the greeting).
 *
 * The tone is synthesized here — the classic dual ring-back, 440 + 480 Hz,
 * a public signalling standard — in two soft bursts with a quiet tail, so
 * pick-up reads as a beat. No ringtone file is bundled and nothing is
 * borrowed from WeChat. It is played through PHNative's AVAudioPlayer path
 * (`playAudio`), which moves AVAudioSession to Playback first, so it sounds
 * through the speaker with the ring/silent switch on and stops through the
 * same `stopSpeaking` the call already uses.
 *
 * One helper for every call surface: Message and Love ring through
 * `startRingback` today; Sync can ring and cancel the same way.
 */

export const RINGBACK_DURATION_MS = 4000;
// A player that never reports back must not hold the call: past this the
// ring is over whatever the player says.
export const RINGBACK_MAX_WAIT_MS = RINGBACK_DURATION_MS + 2000;
export const RINGBACK_SAMPLE_RATE = 16000;
export const RINGBACK_TONES_HZ: readonly number[] = [440, 480];
// Peak amplitude, full scale 1.0: a ring-back sits well under the voice.
export const RINGBACK_GAIN = 0.35;
// Each burst eases in and out so it never clicks.
export const RINGBACK_FADE_MS = 15;

export type RingBurst = { atMs: number; forMs: number };

// Two rings, then quiet until the companion's first word.
export const RINGBACK_CADENCE: readonly RingBurst[] = [
  { atMs: 0, forMs: 1000 },
  { atMs: 1600, forMs: 1000 },
];

const WAV_HEADER_BYTES = 44;

const writeAscii = (bytes: Uint8Array, at: number, text: string) => {
  for (let index = 0; index < text.length; index += 1) {
    bytes[at + index] = text.charCodeAt(index);
  }
};

const toSamples = (ms: number) =>
  Math.round((ms / 1000) * RINGBACK_SAMPLE_RATE);

// The whole ring as a 16-bit mono PCM WAV.
export const ringbackWav = (): Uint8Array => {
  const total = toSamples(RINGBACK_DURATION_MS);
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
  const perTone = RINGBACK_GAIN / RINGBACK_TONES_HZ.length;
  RINGBACK_CADENCE.forEach(({ atMs, forMs }) => {
    const start = toSamples(atMs);
    const count = Math.min(toSamples(forMs), total - start);
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
  });
  return bytes;
};

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// RN has no Buffer and no btoa to rely on; the WAV is encoded once.
export const bytesToBase64 = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triple = (first << 16) | (second << 8) | third;
    parts.push(
      BASE64[(triple >> 18) & 63],
      BASE64[(triple >> 12) & 63],
      index + 1 < bytes.length ? BASE64[(triple >> 6) & 63] : "=",
      index + 2 < bytes.length ? BASE64[triple & 63] : "="
    );
  }
  return parts.join("");
};

let encoded: string | null = null;

export const ringbackWavBase64 = (): string => {
  if (encoded === null) {
    encoded = bytesToBase64(ringbackWav());
  }
  return encoded;
};

// How a ring ended: the tone played through, the tone could not be played
// and the line was held for its length instead, or the caller cancelled.
export type RingbackEnd = "played" | "silent" | "cancelled";

export type Ringback = {
  finished: Promise<RingbackEnd>;
  // Stops the tone at once. Idempotent; nothing after the ring is over.
  cancel: () => void;
};

const swallow = () => undefined;

// The ring is decoration: nothing about it may take a call down, not even a
// native surface that lacks the player (an older binary, a test's mock).
const playTone = (): Promise<boolean> => {
  try {
    return Promise.resolve(nativePlayAudio([ringbackWavBase64()])).then(
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

// Rings. `finished` settles when the caller may go on (pick up); `cancel`
// (hang-up, minimize) silences the tone and settles it as cancelled. A
// player that cannot play still holds the line for `fallbackMs`, so the call
// rings — silently — for the same beat everywhere.
export const startRingback = ({
  fallbackMs = RINGBACK_DURATION_MS,
}: { fallbackMs?: number } = {}): Ringback => {
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
    const remaining = Math.max(0, fallbackMs - (Date.now() - startedAt));
    timer = setTimeout(() => end("silent"), remaining);
  };
  timer = setTimeout(() => {
    if (settled) {
      return;
    }
    stopTone();
    end("silent");
  }, RINGBACK_MAX_WAIT_MS);
  playTone().then((played) => {
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
