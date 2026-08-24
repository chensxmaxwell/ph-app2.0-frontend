import { Platform, Vibration } from "react-native";

let pulse: ReturnType<typeof setInterval> | null = null;
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
  const next = motorLevel(input);
  if (next <= 0) {
    stopToy();
    return;
  }
  const samePulse = pulse && intensity === next;
  intensity = next;
  if (samePulse) {
    return;
  }
  if (pulse) {
    clearInterval(pulse);
    pulse = null;
  }
  pulse = setInterval(() => {
    if (intensity <= 0) {
      return;
    }
    const duration = Platform.OS === "android" ? 18 + intensity * 2 : 40;
    Vibration.vibrate(duration);
  }, Math.max(120, 420 - intensity * 2.4));
};

export const stopToy = () => {
  intensity = 0;
  if (pulse) {
    clearInterval(pulse);
    pulse = null;
  }
  Vibration.cancel();
};

export const getToyIntensity = () => intensity;
