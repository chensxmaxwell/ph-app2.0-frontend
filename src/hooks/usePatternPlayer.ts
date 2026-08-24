import { useCallback, useEffect, useRef, useState } from "react";
import { useHomeScreen } from "./HomeScreenContext";

export const usePatternPlayer = (
  pattern: number[],
  mode: string,
  autoStart = false
) => {
  const { setCurrentMode, setMotorInput } = useHomeScreen() as {
    setCurrentMode: (mode: string) => void;
    setMotorInput: (input: number[]) => void;
  };
  const [playing, setPlaying] = useState(autoStart);
  const [cursor, setCursor] = useState(0);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  useEffect(() => {
    if (!playing || patternRef.current.length === 0) {
      setCurrentMode("");
      setMotorInput([]);
      return undefined;
    }
    setCurrentMode(mode);
    const tick = () => {
      setCursor((current) => {
        const list = patternRef.current;
        const value = list[current] ?? 0;
        setMotorInput([1, value, value, value]);
        return list.length === 0 ? 0 : (current + 1) % list.length;
      });
    };
    tick();
    const timer = setInterval(tick, 380);
    return () => clearInterval(timer);
  }, [mode, playing, setCurrentMode, setMotorInput]);

  useEffect(
    () => () => {
      setCurrentMode("");
      setMotorInput([]);
    },
    [setCurrentMode, setMotorInput]
  );

  const start = useCallback(() => setPlaying(true), []);
  const stop = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((current) => !current), []);

  return {
    playing,
    cursor,
    toggle,
    start,
    stop,
  };
};
