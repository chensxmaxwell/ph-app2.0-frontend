import { useEffect, useState } from "react";
import { AppState } from "react-native";

export const NOW_TICK_MS = 30_000;

// Current epoch that re-renders on a tick, so relative chat labels age in
// place ("now" → "1 min ago" → "3 min ago") without leaving the screen or
// relaunching. iOS suspends JS timers while the app is backgrounded, so the
// clock is also refreshed the moment the app becomes active again.
export const useNow = (tickMs: number = NOW_TICK_MS) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = setInterval(refresh, tickMs);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [tickMs]);

  return now;
};
