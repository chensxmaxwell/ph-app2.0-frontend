const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const shakeMagnitudeToIntensity = (magnitude: number): number => {
  const amplitude = clamp(Math.round(magnitude * 55));
  return amplitude < 12
    ? 0
    : amplitude < 22
    ? 25
    : amplitude < 32
    ? 50
    : amplitude < 42
    ? 75
    : 100;
};

export const motionIntensityToWaveAmplitude = (intensity: number): number =>
  intensity < 12
    ? 20
    : intensity < 28
    ? 65
    : intensity < 48
    ? 110
    : intensity < 72
    ? 155
    : 200;
