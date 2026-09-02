const DB_FLOOR = -45;
const DB_SPAN = 45;

/** Linear -45 dB → 0%, 0 dB → 100%, clamped outside that range. */
export const dbToSensitivityPct = (db: number): number => {
  const pct = ((db - DB_FLOOR) / DB_SPAN) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};
