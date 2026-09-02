let intensity = 0;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const motorLevel = (input?: number[] | null) => {
  if (!input || input.length === 0) {
    return 0;
  }
  if (input.length === 1) {
    return 70;
  }
  return clamp(Number(input[1]) || 0);
};

export const applyToyMotor = (input?: number[] | null) => {
  intensity = motorLevel(input);
};

export const stopToy = () => {
  intensity = 0;
};

export const getToyIntensity = () => intensity;
