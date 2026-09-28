/**
 * Design v2 "Nocturne" tokens (design-v2/spec.md §5). Scoped to the advanced
 * control page and its entry row; the rest of the App keeps its own palette.
 */
import { TextStyle } from 'react-native';

export const nocturne = {
  bg: '#131012',
  bgTop: '#161214',
  bgBottom: '#100D0F',
  ink: '#F3EEF0',
  ink2: '#B9AEB4',
  ink3: '#978C93',
  line: 'rgba(243,238,240,0.10)',
  rail: 'rgba(243,238,240,0.16)',
  accent: '#CCA0DD',
  accentTint: 'rgba(204,160,221,0.14)',
  accentLine: 'rgba(204,160,221,0.55)',
  accentInk: '#1E1420',
  stop: '#B8323F',
  stop2: '#A42C38',
  stopEngBg: '#2A1518',
  stopEngRing: 'rgba(214,86,98,0.55)',
  stopEngInk: '#F2B8BE',
  warn: '#E9B872',
  ok: '#7FD69B',
  knobOn: '#FBF8FA',
  radius: { s: 10, l: 16 },
  pad: 20,
  /** Disabled rows (spec §5: 38 %, always paired with a notice). */
  disabledOpacity: 0.38,
} as const;

/** Quicksand is the App face (text); weights map to the bundled static files. */
export const qs = {
  medium: 'Quicksand-Medium',
  semiBold: 'Quicksand-SemiBold',
  bold: 'Quicksand-Bold',
} as const;

/**
 * Live numbers: Outfit Medium (OFL, assets/fonts/Outfit-Medium.ttf) with
 * tabular figures so values don't shift while a slider streams at ~10 Hz.
 */
export const NUM_FONT = 'Outfit-Medium';
export const num = (size: number, color: string = nocturne.ink): TextStyle => ({
  fontFamily: NUM_FONT,
  fontSize: size,
  /** CSS `line-height: 1` like the design's Outfit values. */
  lineHeight: size,
  color,
  fontVariant: ['tabular-nums'],
});

export const text = (
  family: string,
  size: number,
  color: string = nocturne.ink,
  lineHeight?: number,
): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  color,
  ...(lineHeight ? { lineHeight } : {}),
});
