/** Map a live dB reading to Sound Sensitivity percent: -45 dB → 0%, 0 dB → 100%. */
export const dbToSensitivityPct = (db: number): number => {
  const pct = ((db - -45) / 45) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};
