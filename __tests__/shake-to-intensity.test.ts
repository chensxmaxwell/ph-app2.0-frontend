import { describe, expect, it } from "@jest/globals";
import {
  motionIntensityToWaveAmplitude,
  shakeMagnitudeToIntensity,
} from "../src/screens/motion/shake-to-intensity";

describe("shakeMagnitudeToIntensity", () => {
  it("maps rest to zero intensity", () => {
    expect(shakeMagnitudeToIntensity(0)).toBe(0);
  });

  it("maps intermediate motion to intermediate intensity", () => {
    expect(shakeMagnitudeToIntensity(0.5)).toBe(28);
    expect(shakeMagnitudeToIntensity(1)).toBe(55);
  });

  it("clamps strong motion at full intensity", () => {
    expect(shakeMagnitudeToIntensity(2)).toBe(100);
  });

  it("preserves nearby intermediate levels instead of snapping to gears", () => {
    expect(shakeMagnitudeToIntensity(0.72)).toBe(40);
    expect(shakeMagnitudeToIntensity(0.74)).toBe(41);
  });
});

describe("motionIntensityToWaveAmplitude", () => {
  it("linearly maps the shared intensity onto the wave", () => {
    expect(motionIntensityToWaveAmplitude(0)).toBe(20);
    expect(motionIntensityToWaveAmplitude(50)).toBe(110);
    expect(motionIntensityToWaveAmplitude(100)).toBe(200);
  });
});
