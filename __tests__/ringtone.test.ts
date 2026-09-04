import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { playAudioWithNative, stopNativeTts } from "../src/services/voice-input";
import {
  clampRingDuration,
  playRingback,
  RING_CADENCE_MS,
  RING_DURATION_MS,
  RING_MAX_MS,
  RING_MIN_MS,
  RING_SAMPLE_RATE,
  RINGBACK_TONE_HZ,
  ringbackToneWav,
} from "../src/services/ringtone";

/**
 * Sync (and, in a sibling change, the calls) ring for a few seconds before
 * the companion greets — the way a WeChat call does. The tone is our own:
 * a dual-tone ring-back synthesized on the phone as a small PCM WAV and
 * played through PHNative's AVAudioPlayer, the same player the cloud voice
 * uses. No ringtone file is bundled and nothing is copied from anyone.
 */

jest.mock("../src/services/voice-input", () => ({
  playAudioWithNative: jest.fn(),
  stopNativeTts: jest.fn(),
}));

const playMock = playAudioWithNative as jest.Mock<typeof playAudioWithNative>;
const stopMock = stopNativeTts as jest.Mock<typeof stopNativeTts>;

// Little-endian readers over the decoded WAV.
const bytesOf = (base64: string) => Buffer.from(base64, "base64");
const samplesOf = (wav: Buffer) => {
  const out: number[] = [];
  for (let offset = 44; offset + 1 < wav.length; offset += 2) {
    out.push(wav.readInt16LE(offset));
  }
  return out;
};
const window = (samples: number[], fromMs: number, toMs: number) =>
  samples.slice(
    Math.floor((fromMs / 1000) * RING_SAMPLE_RATE),
    Math.floor((toMs / 1000) * RING_SAMPLE_RATE)
  );
const rms = (samples: number[]) =>
  Math.sqrt(
    samples.reduce((sum, value) => sum + value * value, 0) /
      Math.max(1, samples.length)
  );
// Goertzel power of one frequency over a window, normalised by its length.
const power = (samples: number[], hz: number) => {
  const step = (2 * Math.PI * hz) / RING_SAMPLE_RATE;
  let re = 0;
  let im = 0;
  samples.forEach((value, index) => {
    re += value * Math.cos(step * index);
    im -= value * Math.sin(step * index);
  });
  return Math.sqrt(re * re + im * im) / samples.length;
};

beforeEach(() => {
  jest.useFakeTimers();
  playMock.mockReset();
  stopMock.mockReset();
  playMock.mockResolvedValue(true);
  stopMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the ring-back tone", () => {
  it("rings for about four seconds, never under three or over five", () => {
    expect(RING_DURATION_MS).toBeGreaterThanOrEqual(3500);
    expect(RING_DURATION_MS).toBeLessThanOrEqual(4500);
    expect(RING_MIN_MS).toBe(3000);
    expect(RING_MAX_MS).toBe(5000);
    expect(clampRingDuration(RING_DURATION_MS)).toBe(RING_DURATION_MS);
    // The calls' 1.6 s connect delay would be too short a ring.
    expect(clampRingDuration(1600)).toBe(RING_MIN_MS);
    expect(clampRingDuration(9000)).toBe(RING_MAX_MS);
  });

  it("is a valid 8 kHz mono 16-bit PCM WAV exactly as long as the ring", () => {
    const wav = bytesOf(ringbackToneWav(RING_DURATION_MS));
    const dataBytes = (RING_DURATION_MS / 1000) * RING_SAMPLE_RATE * 2;

    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.readUInt32LE(4)).toBe(36 + dataBytes);
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
    expect(wav.readUInt32LE(16)).toBe(16);
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(RING_SAMPLE_RATE);
    expect(wav.readUInt32LE(28)).toBe(RING_SAMPLE_RATE * 2); // byte rate
    expect(wav.readUInt16LE(32)).toBe(2); // block align
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    expect(wav.readUInt32LE(40)).toBe(dataBytes);
    expect(wav.length).toBe(44 + dataBytes);
  });

  it("has a ring cadence: two short bursts, then a pause, twice over — and ends on silence so the greeting never overlaps it", () => {
    const samples = samplesOf(bytesOf(ringbackToneWav(RING_DURATION_MS)));
    const [on, off, onAgain, pause] = RING_CADENCE_MS;
    expect(on + off + onAgain + pause).toBe(2000);

    // First cycle.
    expect(rms(window(samples, 50, on - 50))).toBeGreaterThan(2000);
    expect(rms(window(samples, on + 50, on + off - 50))).toBe(0);
    expect(rms(window(samples, on + off + 50, on + off + onAgain - 50))).toBeGreaterThan(2000);
    expect(rms(window(samples, on + off + onAgain + 50, 2000))).toBe(0);
    // Second cycle, same shape; the ring closes on its pause.
    expect(rms(window(samples, 2050, 2000 + on - 50))).toBeGreaterThan(2000);
    expect(rms(window(samples, 3050, RING_DURATION_MS))).toBe(0);
  });

  it("is a dual tone of 440 and 480 Hz, well under full scale", () => {
    expect(RINGBACK_TONE_HZ).toEqual([440, 480]);
    const samples = samplesOf(bytesOf(ringbackToneWav(RING_DURATION_MS)));
    const burst = window(samples, 40, 360);

    const low = power(burst, 440);
    const high = power(burst, 480);
    const elsewhere = power(burst, 700);
    expect(low).toBeGreaterThan(elsewhere * 10);
    expect(high).toBeGreaterThan(elsewhere * 10);
    // Both partials carry about the same weight.
    expect(low / high).toBeGreaterThan(0.5);
    expect(low / high).toBeLessThan(2);
    const peak = Math.max(...samples.map(Math.abs));
    expect(peak).toBeLessThanOrEqual(0.5 * 32767);
    expect(peak).toBeGreaterThan(0.2 * 32767);
  });

  it("is deterministic and clamps its own length", () => {
    expect(ringbackToneWav(RING_DURATION_MS)).toBe(
      ringbackToneWav(RING_DURATION_MS)
    );
    const long = bytesOf(ringbackToneWav(9000));
    expect(long.readUInt32LE(40)).toBe((RING_MAX_MS / 1000) * RING_SAMPLE_RATE * 2);
  });
});

describe("playRingback", () => {
  it("plays the tone once through the native player and is done when the ring is over, cutting any tail", async () => {
    const ring = playRingback({ durationMs: RING_DURATION_MS });
    let finished = false;
    ring.done.then(() => {
      finished = true;
    });

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(playMock.mock.calls[0][0]).toEqual([
      ringbackToneWav(RING_DURATION_MS),
    ]);
    expect(ring.durationMs).toBe(RING_DURATION_MS);

    jest.advanceTimersByTime(RING_DURATION_MS - 10);
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(stopMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(20);
    await Promise.resolve();
    expect(finished).toBe(true);
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it("stop() silences the ring at once and settles done; a second stop and the timer are no-ops", async () => {
    const ring = playRingback({ durationMs: RING_DURATION_MS });
    let finished = false;
    ring.done.then(() => {
      finished = true;
    });

    jest.advanceTimersByTime(700);
    ring.stop();
    await Promise.resolve();
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(finished).toBe(true);

    ring.stop();
    jest.advanceTimersByTime(RING_MAX_MS);
    await Promise.resolve();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it("rings for the clamped length, and a build with no native player still rings silently for as long", async () => {
    playMock.mockResolvedValue(false);
    const ring = playRingback({ durationMs: 1600 });
    let finished = false;
    ring.done.then(() => {
      finished = true;
    });
    expect(ring.durationMs).toBe(RING_MIN_MS);

    jest.advanceTimersByTime(RING_MIN_MS - 10);
    await Promise.resolve();
    expect(finished).toBe(false);
    jest.advanceTimersByTime(20);
    await Promise.resolve();
    expect(finished).toBe(true);
  });
});
