export type NamedPattern = {
  title: string;
  pattern: number[];
};

export const BUILTIN_PATTERNS: NamedPattern[] = [
  {
    title: "Untitled",
    pattern: [20, 40, 60, 80, 100, 80, 60, 40, 20, 10],
  },
  {
    title: "Pulse",
    pattern: [
      0, 99, 34, 48, 50, 50, 4, 14, 23, 35, 70, 100, 0, 100, 34, 48, 80, 50, 4,
      55, 23, 44, 70, 22, 0, 5, 20, 30, 40, 10,
    ],
  },
  {
    title: "Wave",
    pattern: [
      10, 20, 35, 55, 75, 90, 100, 90, 75, 55, 35, 20, 10, 8, 16, 28, 48, 70,
      88, 70, 48, 28, 16, 8,
    ],
  },
  {
    title: "Stagger",
    pattern: [
      15, 80, 15, 80, 20, 90, 20, 90, 30, 100, 30, 60, 10, 70, 10, 70,
    ],
  },
];

export const wavePattern = (peak: number) => {
  const height = Math.max(12, Math.min(100, peak));
  return Array.from({ length: 24 }, (_, index) =>
    Math.round((Math.sin(index / 3) * 0.5 + 0.5) * height)
  );
};

export const nextNamedPattern = (
  currentTitle: string,
  direction: "next" | "prev"
) => {
  const index = Math.max(
    0,
    BUILTIN_PATTERNS.findIndex((item) => item.title === currentTitle)
  );
  const delta = direction === "next" ? 1 : -1;
  const next =
    (index + delta + BUILTIN_PATTERNS.length) % BUILTIN_PATTERNS.length;
  return BUILTIN_PATTERNS[next];
};
