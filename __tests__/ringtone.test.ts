import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { nativePlayAudio, nativeStopSpeaking } from "../src/native/ph-native";
import {
  bytesToBase64,
  RINGBACK_CADENCE,
  RINGBACK_DURATION_MS,
  RINGBACK_GAIN,
  RINGBACK_MAX_WAIT_MS,
  RINGBACK_SAMPLE_RATE,
  RINGBACK_TONES_HZ,
  ringbackWav,
  ringbackWavBase64,
  startRingback,
} from "../src/services/ringtone";

/**
 * Maxwell, TestFlight 1.2 (19): a call must ring like a phone call before
 * the companion picks up — a WeChat-style ring-back of about four seconds,
 * then the greeting. The tone is synthesized here (the classic dual
 * ring-back, 440 + 480 Hz, a public signalling standard), never a copied
 * ringtone file, and is played through PHNative's existing AVAudioPlayer
 * path. One helper, `startRingback`, so Message, Love and later Sync ring
 * the same way and cancel the same way.
 */

jest.mock("../src/native/ph-native", () => ({
  nativePlayAudio: jest.fn(),
  nativeStopSpeaking: jest.fn(),
}));

const playMock = nativePlayAudio as jest.Mock<typeof nativePlayAudio>;
const stopMock = nativeStopSpeaking as jest.Mock<typeof nativeStopSpeaking>;

const wav = ringbackWav();
const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
const ascii = (at: number, length: number) =>
  String.fromCharCode(...wav.subarray(at, at + length));
const DATA_AT = 44;
const sampleCount = (wav.byteLength - DATA_AT) / 2;
const sample = (index: number) =>
  view.getInt16(DATA_AT + index * 2, true) / 32768;
const toSample = (ms: number) => Math.round((ms / 1000) * RINGBACK_SAMPLE_RATE);

const rms = (fromMs: number, toMs: number) => {
  const from = toSample(fromMs);
  const to = toSample(toMs);
  let sum = 0;
  for (let index = from; index < to; index += 1) {
    sum += sample(index) ** 2;
  }
  return Math.sqrt(sum / (to - from));
};

const peak = (fromMs: number, toMs: number) => {
  let max = 0;
  for (let index = toSample(fromMs); index < toSample(toMs); index += 1) {
    max = Math.max(max, Math.abs(sample(index)));
  }
  return max;
};

// Goertzel: the energy of one frequency in a window, relative to the window.
const energyAt = (hz: number, fromMs: number, toMs: number) => {
  const from = toSample(fromMs);
  const to = toSample(toMs);
  const coefficient = 2 * Math.cos((2 * Math.PI * hz) / RINGBACK_SAMPLE_RATE);
  let previous = 0;
  let before = 0;
  for (let index = from; index < to; index += 1) {
    const current = sample(index) + coefficient * previous - before;
    before = previous;
    previous = current;
  }
  const power = previous ** 2 + before ** 2 - coefficient * previous * before;
  return power / (to - from) ** 2;
};

const flush = async () => {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  playMock.mockReset();
  stopMock.mockReset();
  stopMock.mockResolvedValue(undefined);
});

describe("the ring-back tone", () => {
  it("is about four seconds — Maxwell asked for 3–5 s, WeChat-style", () => {
    expect(RINGBACK_DURATION_MS).toBe(4000);
    expect(RINGBACK_DURATION_MS).toBeGreaterThanOrEqual(3000);
    expect(RINGBACK_DURATION_MS).toBeLessThanOrEqual(5000);
    expect(sampleCount).toBe(toSample(RINGBACK_DURATION_MS));
  });

  it("is a valid 16-bit mono PCM WAV that AVAudioPlayer can decode", () => {
    expect(ascii(0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(wav.byteLength - 8);
    expect(ascii(8, 4)).toBe("WAVE");
    expect(ascii(12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(RINGBACK_SAMPLE_RATE);
    expect(view.getUint32(28, true)).toBe(RINGBACK_SAMPLE_RATE * 2);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(wav.byteLength - DATA_AT);
    expect((wav.byteLength - DATA_AT) % 2).toBe(0);
  });

  it("rings in bursts with silence between them and a quiet tail before the voice picks up", () => {
    expect(RINGBACK_CADENCE.length).toBeGreaterThanOrEqual(2);
    RINGBACK_CADENCE.forEach((burst, index) => {
      // Tone inside the burst (past the fades)…
      expect(
        rms(burst.atMs + 50, burst.atMs + burst.forMs - 50)
      ).toBeGreaterThan(0.15);
      // …and digital silence between it and the next.
      const next = RINGBACK_CADENCE[index + 1];
      const gapEnd = next ? next.atMs : RINGBACK_DURATION_MS;
      expect(gapEnd - (burst.atMs + burst.forMs)).toBeGreaterThanOrEqual(400);
      expect(rms(burst.atMs + burst.forMs + 20, gapEnd)).toBe(0);
    });
    // The last burst ends well before the greeting so pick-up reads as a beat.
    const last = RINGBACK_CADENCE[RINGBACK_CADENCE.length - 1];
    expect(
      RINGBACK_DURATION_MS - (last.atMs + last.forMs)
    ).toBeGreaterThanOrEqual(1000);
  });

  it("is the classic dual ring-back (440 + 480 Hz), soft, with fades — not a copied ringtone", () => {
    expect([...RINGBACK_TONES_HZ]).toEqual([440, 480]);
    const [burst] = RINGBACK_CADENCE;
    const from = burst.atMs + 100;
    const to = burst.atMs + burst.forMs - 100;
    const inBand = Math.min(energyAt(440, from, to), energyAt(480, from, to));
    const outOfBand = Math.max(
      energyAt(300, from, to),
      energyAt(1000, from, to),
      energyAt(1600, from, to)
    );
    expect(inBand).toBeGreaterThan(outOfBand * 100);
    // Soft: a ring-back sits well under full scale.
    expect(RINGBACK_GAIN).toBeLessThanOrEqual(0.5);
    expect(peak(0, RINGBACK_DURATION_MS)).toBeLessThanOrEqual(
      RINGBACK_GAIN + 0.01
    );
    // No clicks: each burst starts and ends near zero.
    expect(Math.abs(sample(toSample(burst.atMs)))).toBeLessThan(0.02);
    expect(
      Math.abs(sample(toSample(burst.atMs + burst.forMs) - 1))
    ).toBeLessThan(0.02);
  });

  it("encodes to base64 exactly as Node does, and the encoding is computed once", () => {
    expect(ringbackWavBase64()).toBe(Buffer.from(wav).toString("base64"));
    expect(ringbackWavBase64()).toBe(ringbackWavBase64());
    [[], [1], [1, 2], [1, 2, 3], [255, 254, 253, 252]].forEach((bytes) => {
      expect(bytesToBase64(Uint8Array.from(bytes))).toBe(
        Buffer.from(bytes).toString("base64")
      );
    });
  });
});

describe("startRingback", () => {
  it("plays the tone once through the native player and finishes as `played` when playback ends", async () => {
    let endPlayback: ((played: boolean) => void) | null = null;
    playMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          endPlayback = resolve;
        })
    );
    const ring = startRingback();
    let end: string | null = null;
    ring.finished.then((value) => {
      end = value;
    });
    await flush();

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalledWith([ringbackWavBase64()]);
    expect(end).toBeNull();

    endPlayback!(true);
    await flush();
    expect(end).toBe("played");
    expect(stopMock).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("holds the line for the ring's length when the tone cannot be played, and finishes as `silent`", async () => {
    playMock.mockResolvedValue(false);
    const ring = startRingback();
    let end: string | null = null;
    ring.finished.then((value) => {
      end = value;
    });
    await flush();
    expect(end).toBeNull();

    jest.advanceTimersByTime(RINGBACK_DURATION_MS - 10);
    await flush();
    expect(end).toBeNull();
    jest.advanceTimersByTime(20);
    await flush();
    expect(end).toBe("silent");
  });

  it("treats a native player that throws like one that could not play", async () => {
    playMock.mockRejectedValue(new Error("no bridge"));
    const ring = startRingback();
    let end: string | null = null;
    ring.finished.then((value) => {
      end = value;
    });
    await flush();
    jest.advanceTimersByTime(RINGBACK_DURATION_MS + 10);
    await flush();
    expect(end).toBe("silent");
  });

  it("a native surface with no player or no stop at all (a build, or a test, without them) rings silently instead of throwing — the ring never takes a call down", async () => {
    playMock.mockImplementation(() => {
      throw new TypeError("nativePlayAudio is not a function");
    });
    stopMock.mockImplementation(() => {
      throw new TypeError("nativeStopSpeaking is not a function");
    });
    let ring: ReturnType<typeof startRingback> | null = null;
    expect(() => {
      ring = startRingback();
    }).not.toThrow();
    let end: string | null = null;
    ring!.finished.then((value) => {
      end = value;
    });
    await flush();
    jest.advanceTimersByTime(RINGBACK_DURATION_MS + 10);
    await flush();
    expect(end).toBe("silent");
    // Cancelling with a broken stop is just as harmless.
    const second = startRingback();
    expect(() => second.cancel()).not.toThrow();
    expect(await second.finished).toBe("cancelled");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("never lets a player that stops reporting hold the call: `silent` at RINGBACK_MAX_WAIT_MS, with the player told to stop", async () => {
    playMock.mockImplementation(() => new Promise<boolean>(() => undefined));
    const ring = startRingback();
    let end: string | null = null;
    ring.finished.then((value) => {
      end = value;
    });
    await flush();
    expect(RINGBACK_MAX_WAIT_MS).toBeGreaterThan(RINGBACK_DURATION_MS);
    jest.advanceTimersByTime(RINGBACK_MAX_WAIT_MS - 10);
    await flush();
    expect(end).toBeNull();
    jest.advanceTimersByTime(20);
    await flush();
    expect(end).toBe("silent");
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it("cancel stops the native player at once and finishes as `cancelled`; a late playback end changes nothing", async () => {
    let endPlayback: ((played: boolean) => void) | null = null;
    playMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          endPlayback = resolve;
        })
    );
    const ring = startRingback();
    let end: string | null = null;
    ring.finished.then((value) => {
      end = value;
    });
    await flush();

    ring.cancel();
    await flush();
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(end).toBe("cancelled");
    expect(jest.getTimerCount()).toBe(0);

    endPlayback!(true);
    await flush();
    expect(end).toBe("cancelled");
    // Cancelling again, or after the end, sends nothing more.
    ring.cancel();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it("cancel after the ring has finished is a no-op", async () => {
    playMock.mockResolvedValue(true);
    const ring = startRingback();
    await flush();
    expect(await ring.finished).toBe("played");
    ring.cancel();
    expect(stopMock).not.toHaveBeenCalled();
  });
});
