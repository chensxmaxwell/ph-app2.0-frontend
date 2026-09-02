const INTENSITY_PER_SHAKE_UNIT = 55;
const MIN_WAVE_AMPLITUDE = 20;
const MAX_WAVE_AMPLITUDE = 200;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const shakeMagnitudeToIntensity = (magnitude: number): number =>
  clamp(Math.round(magnitude * INTENSITY_PER_SHAKE_UNIT));

export const motionIntensityToWaveAmplitude = (intensity: number): number =>
  MIN_WAVE_AMPLITUDE +
  (clamp(intensity) / 100) * (MAX_WAVE_AMPLITUDE - MIN_WAVE_AMPLITUDE);
