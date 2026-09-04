import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { nativePlayAudio, nativeStopSpeaking } from "../src/native/ph-native";
import { bytesToBase64 } from "../src/services/bytes";
import {
  pickRingbackDuration,
  RINGBACK_BURST_MS,
  RINGBACK_FADE_MS,
  RINGBACK_GAIN,
  RINGBACK_GAP_MS,
  RINGBACK_GRACE_MS,
  RINGBACK_MAX_MS,
  RINGBACK_MIN_MS,
  RINGBACK_SAMPLE_RATE,
  RINGBACK_TONES_HZ,
  ringbackWav,
  ringbackWavBase64,
  startRingback,
} from "../src/services/ringtone";

/**
 * Maxwell, TestFlight 1.2 (19): a call must ring like a phone call before
 * the companion picks up — a WeChat-style ring-back, then the greeting — and
 * (his follow-up) the wait is not a fixed beat but **a fresh uniform draw
 * between 2 and 5 seconds on every connect**, like a person who picks up
 * when they pick up. The tone is synthesized here to exactly that length
 * (the classic dual ring-back, 440 + 480 Hz, a public signalling standard,
 * cut clean where the call is answered), never a copied ringtone file, and
 * is played through PHNative's existing AVAudioPlayer path. One helper,
 * `startRingback`, so Message, Love and later Sync ring the same way and
 * cancel the same way.
 */

jest.mock("../src/native/ph-native", () => ({
  nativePlayAudio: jest.fn(),
  nativeStopSpeaking: jest.fn(),
}));

const playMock = nativePlayAudio as jest.Mock<typeof nativePlayAudio>;
const stopMock = nativeStopSpeaking as jest.Mock<typeof nativeStopSpeaking>;

const DATA_AT = 44;
const toSample = (ms: number) => Math.round((ms / 1000) * RINGBACK_SAMPLE_RATE);

// Reads one synthesized ring.
const tone = (durationMs: number) => {
  const wav = ringbackWav(durationMs);
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const sample = (index: number) =>
    view.getInt16(DATA_AT + index * 2, true) / 32768;
  const sampleCount = (wav.byteLength - DATA_AT) / 2;
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
  // Goertzel: the energy of one frequency in a window, relative to it.
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
  const ascii = (at: number, length: number) =>
    String.fromCharCode(...wav.subarray(at, at + length));
  return { wav, view, ascii, sample, sampleCount, rms, peak, energyAt };
};

// Where the cadence puts its bursts inside a ring of `durationMs`: full
// ones, and the one the pick-up cuts short (if the pick-up lands in a burst).
const burstsWithin = (durationMs: number) => {
  const period = RINGBACK_BURST_MS + RINGBACK_GAP_MS;
  const bursts: { atMs: number; toMs: number; cut: boolean }[] = [];
  for (let atMs = 0; atMs < durationMs; atMs += period) {
    const toMs = Math.min(atMs + RINGBACK_BURST_MS, durationMs);
    bursts.push({ atMs, toMs, cut: toMs < atMs + RINGBACK_BURST_MS });
  }
  return bursts;
};

const flush = async () => {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
  }
};

let randomSpy: jest.SpiedFunction<typeof Math.random> | null = null;
const drawOf = (fraction: number) => {
  randomSpy = jest.spyOn(Math, "random").mockReturnValue(fraction);
};

beforeEach(() => {
  jest.useFakeTimers();
  playMock.mockReset();
  stopMock.mockReset();
  stopMock.mockResolvedValue(undefined);
});

afterEach(() => {
  randomSpy?.mockRestore();
  randomSpy = null;
});

describe("the ring-back's length", () => {
  it("is drawn uniformly between 2 and 5 s — Maxwell: not a fixed beat, a fresh draw on every connect", () => {
    expect(RINGBACK_MIN_MS).toBe(2000);
    expect(RINGBACK_MAX_MS).toBe(5000);
    expect(pickRingbackDuration(() => 0)).toBe(RINGBACK_MIN_MS);
    expect(pickRingbackDuration(() => 0.5)).toBe(3500);
    expect(pickRingbackDuration(() => 0.999999)).toBeLessThanOrEqual(
      RINGBACK_MAX_MS
    );
    expect(pickRingbackDuration(() => 0.999999)).toBeGreaterThanOrEqual(
      RINGBACK_MAX_MS - 1
    );
    // Whole milliseconds, straight from Math.random by default.
    expect(Number.isInteger(pickRingbackDuration(() => 0.123456))).toBe(true);
    const draws = Array.from({ length: 500 }, () => pickRingbackDuration());
    draws.forEach((draw) => {
      expect(draw).toBeGreaterThanOrEqual(RINGBACK_MIN_MS);
      expect(draw).toBeLessThanOrEqual(RINGBACK_MAX_MS);
    });
    expect(Math.min(...draws)).toBeLessThan(2600);
    expect(Math.max(...draws)).toBeGreaterThan(4400);
    expect(new Set(draws).size).toBeGreaterThan(50);
  });
});

describe("the ring-back tone", () => {
  it.each([RINGBACK_MIN_MS, 3300, RINGBACK_MAX_MS])(
    "at %i ms is a valid 16-bit mono PCM WAV of exactly that length",
    (durationMs) => {
      const { wav, view, ascii, sampleCount } = tone(durationMs);
      expect(sampleCount).toBe(toSample(durationMs));
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
    }
  );

  it.each([RINGBACK_MIN_MS, 3300, RINGBACK_MAX_MS])(
    "at %i ms rings on the cadence (1 s on, 0.6 s off) for as long as it lasts, with digital silence in the gaps, and is cut clean where the call is picked up",
    (durationMs) => {
      expect(RINGBACK_BURST_MS).toBe(1000);
      expect(RINGBACK_GAP_MS).toBe(600);
      const { rms, sample, sampleCount } = tone(durationMs);
      const bursts = burstsWithin(durationMs);
      expect(bursts.length).toBeGreaterThanOrEqual(2);
      const margin = RINGBACK_FADE_MS + 35;
      bursts.forEach((burst, index) => {
        // Tone inside the burst, past the fades (a cut too brief to leave
        // room past both fades is measured by the pick-up test below)…
        if (burst.toMs - burst.atMs > 2 * margin + 20) {
          expect(rms(burst.atMs + margin, burst.toMs - margin)).toBeGreaterThan(
            0.15
          );
        }
        // …and nothing at all between it and the next.
        const next = bursts[index + 1];
        if (next) {
          expect(rms(burst.toMs + 20, next.atMs)).toBe(0);
        }
      });
      // The pick-up: the last sample is at rest, cut mid-burst or not.
      expect(Math.abs(sample(sampleCount - 1))).toBeLessThan(0.02);
    }
  );

  it("a pick-up that lands in a burst fades that burst out instead of chopping it (no click), and a pick-up in a gap is already quiet", () => {
    // 2000 ms lands 400 ms into the second burst; 3300 lands 100 ms into
    // the third; 4500 lands in the gap after the third.
    const cut = tone(RINGBACK_MIN_MS);
    expect(cut.rms(1650, 1950)).toBeGreaterThan(0.15);
    expect(cut.peak(1990, 2000)).toBeLessThan(0.15);
    expect(Math.abs(cut.sample(cut.sampleCount - 1))).toBeLessThan(0.02);
    const brief = tone(3300);
    expect(brief.rms(3230, 3270)).toBeGreaterThan(0.1);
    expect(Math.abs(brief.sample(brief.sampleCount - 1))).toBeLessThan(0.02);
    const gap = tone(4500);
    expect(gap.rms(4230, 4500)).toBe(0);
  });

  it("is the classic dual ring-back (440 + 480 Hz), soft, with fades — not a copied ringtone", () => {
    expect([...RINGBACK_TONES_HZ]).toEqual([440, 480]);
    const { energyAt, peak, sample } = tone(RINGBACK_MAX_MS);
    const from = 100;
    const to = RINGBACK_BURST_MS - 100;
    const inBand = Math.min(energyAt(440, from, to), energyAt(480, from, to));
    const outOfBand = Math.max(
      energyAt(300, from, to),
      energyAt(1000, from, to),
      energyAt(1600, from, to)
    );
    expect(inBand).toBeGreaterThan(outOfBand * 100);
    // Soft: a ring-back sits well under the voice.
    expect(RINGBACK_GAIN).toBeLessThanOrEqual(0.5);
    expect(peak(0, RINGBACK_MAX_MS)).toBeLessThanOrEqual(RINGBACK_GAIN + 0.01);
    // No clicks: a burst starts and ends near zero.
    expect(Math.abs(sample(0))).toBeLessThan(0.02);
    expect(Math.abs(sample(toSample(RINGBACK_BURST_MS) - 1))).toBeLessThan(
      0.02
    );
  });

  it("encodes to base64 exactly as Node does", () => {
    [RINGBACK_MIN_MS, 2750].forEach((durationMs) => {
      expect(ringbackWavBase64(durationMs)).toBe(
        Buffer.from(ringbackWav(durationMs)).toString("base64")
      );
    });
    [[], [1], [1, 2], [1, 2, 3], [255, 254, 253, 252]].forEach((bytes) => {
      expect(bytesToBase64(Uint8Array.from(bytes))).toBe(
        Buffer.from(bytes).toString("base64")
      );
    });
  });
});

describe("startRingback", () => {
  it("draws the length, plays a tone of exactly that length once through the native player, and finishes as `played` when playback ends", async () => {
    drawOf(0.5);
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

    expect(ring.durationMs).toBe(3500);
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalledWith([ringbackWavBase64(3500)]);
    expect(end).toBeNull();

    endPlayback!(true);
    await flush();
    expect(end).toBe("played");
    expect(stopMock).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("two connects draw two lengths — nothing about the ring is cached across calls", async () => {
    playMock.mockResolvedValue(true);
    drawOf(0);
    const short = startRingback();
    randomSpy!.mockReturnValue(1);
    const long = startRingback();
    await flush();
    expect(short.durationMs).toBe(RINGBACK_MIN_MS);
    expect(long.durationMs).toBe(RINGBACK_MAX_MS);
    expect(playMock.mock.calls[0][0]).toEqual([
      ringbackWavBase64(RINGBACK_MIN_MS),
    ]);
    expect(playMock.mock.calls[1][0]).toEqual([
      ringbackWavBase64(RINGBACK_MAX_MS),
    ]);
    expect(playMock.mock.calls[0][0]).not.toEqual(playMock.mock.calls[1][0]);
  });

  it("a caller may fix the length instead (Sync, or a test)", async () => {
    playMock.mockResolvedValue(true);
    const ring = startRingback({ durationMs: 2500 });
    await flush();
    expect(ring.durationMs).toBe(2500);
    expect(playMock).toHaveBeenCalledWith([ringbackWavBase64(2500)]);
  });

  it("holds the line for the drawn length when the tone cannot be played, and finishes as `silent`", async () => {
    drawOf(0.5);
    playMock.mockResolvedValue(false);
    const ring = startRingback();
    let end: string | null = null;
    ring.finished.then((value) => {
      end = value;
    });
    await flush();
    expect(end).toBeNull();

    jest.advanceTimersByTime(ring.durationMs - 10);
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
    jest.advanceTimersByTime(ring.durationMs + 10);
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
    jest.advanceTimersByTime(ring!.durationMs + 10);
    await flush();
    expect(end).toBe("silent");
    // Cancelling with a broken stop is just as harmless.
    const second = startRingback();
    expect(() => second.cancel()).not.toThrow();
    expect(await second.finished).toBe("cancelled");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("never lets a player that stops reporting hold the call: `silent` a grace past the drawn length, with the player told to stop", async () => {
    drawOf(0.5);
    playMock.mockImplementation(() => new Promise<boolean>(() => undefined));
    const ring = startRingback();
    let end: string | null = null;
    ring.finished.then((value) => {
      end = value;
    });
    await flush();
    expect(RINGBACK_GRACE_MS).toBeGreaterThanOrEqual(1000);
    jest.advanceTimersByTime(ring.durationMs + RINGBACK_GRACE_MS - 10);
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
