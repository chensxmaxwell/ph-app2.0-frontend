import React, { useEffect, useRef } from "react";
import { useHomeScreen } from "../hooks/HomeScreenContext";
import { alarmMatchesNow, loadAlarms } from "./alarms";

const PLAY_MS = 25000;

export const AlarmRunner = () => {
  const { setCurrentMode, setMotorInput } = useHomeScreen() as {
    setCurrentMode: (mode: string) => void;
    setMotorInput: (input: number[]) => void;
  };
  const fired = useRef(new Set<string>());

  useEffect(() => {
    let playing = false;
    let cursor = 0;
    let stopAt = 0;
    let pattern: number[] = [];

    const timer = setInterval(async () => {
      const now = new Date();
      if (playing) {
        if (Date.now() >= stopAt) {
          playing = false;
          setCurrentMode("");
          setMotorInput([]);
          return;
        }
        const value = pattern[cursor % Math.max(pattern.length, 1)] ?? 40;
        cursor += 1;
        setMotorInput([1, value, value, value]);
        return;
      }

      const alarms = await loadAlarms();
      const hit = alarms.find((alarm) => {
        const stamp = `${alarm.id}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
        return alarmMatchesNow(alarm, now) && !fired.current.has(stamp);
      });
      if (!hit) {
        return;
      }
      const stamp = `${hit.id}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      fired.current.add(stamp);
      playing = true;
      pattern = hit.pattern.length ? hit.pattern : [40, 70, 100, 70];
      cursor = 0;
      stopAt = Date.now() + PLAY_MS;
      setCurrentMode("alarm");
    }, 1000);

    return () => {
      clearInterval(timer);
      setCurrentMode("");
      setMotorInput([]);
    };
  }, [setCurrentMode, setMotorInput]);

  return null;
};
