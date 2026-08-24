import { useState } from "react";
import { BUILTIN_PATTERNS, nextNamedPattern } from "../../../../../../store/patterns";

export const usePlayPattern = ({
  pattern,
  title,
}: UsePlayPatternProps) => {
  const [start, setStart] = useState(true);
  const [current, setCurrent] = useState({
    title,
    pattern: pattern?.length ? pattern : BUILTIN_PATTERNS[0].pattern,
  });

  const handlePlayButtonPress = () => setStart((value) => !value);
  const handlePatternNavigate = (direction: "next" | "prev") => {
    const next = nextNamedPattern(current.title, direction);
    setCurrent(next);
    setStart(true);
  };

  return {
    start,
    current,
    handlePlayButtonPress,
    handlePatternNavigate,
  };
};

type UsePlayPatternProps = {
  pattern?: number[];
  title: string;
};
