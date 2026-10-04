/**
 * Design v4 tokens (design-v4/spec.md §2). Every value is an existing App token
 * (src/common/styles/colors.ts, screen-wrapper gradient, fonts.ts) unless noted.
 * No page-specific dark theme and no second typeface: Quicksand-Bold only.
 */
import { TextStyle } from 'react-native';

import { colors } from '../../common/styles/colors';

export const v4 = {
  white: colors.white,
  /** 60 % white: secondary text off-card only (entry row detail). */
  white60: colors.grayLighter,
  /** Card / row surface. */
  card: colors.grayLight,
  /** Pills, slider track, switch off. */
  pill: colors.grayLightest,
  /** Sole accent: switch on, value box while dragging, dragged-thumb ring. */
  accent: colors.accentLightPink,
  /** SeekBar fill start (seek-bar/index.tsx). */
  accentDeep: '#8C60B2',
  green: colors.neonGreen,
  red: 'red',
  /** ScreenWrapper gradient bottom, reused as ink on white / accent (NEW use). */
  ink: '#2A2659',
  radius: 10,
  /** Controls dimmed while paused / disconnected (spec §5). */
  dimOpacity: 0.4,
} as const;

export const QB = 'Quicksand-Bold';

export const text = (size: number, color: string = v4.white, lineHeight?: number): TextStyle => ({
  fontFamily: QB,
  fontSize: size,
  color,
  ...(lineHeight ? { lineHeight } : {}),
});
