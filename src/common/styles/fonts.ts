const fontSizes = {
  xsmall: 10,
  small: 13,
  smallX: 14,
  medium: 16,
  mediumX: 18,
  medium2X: 20,
  large: 24,
  largeX: 31,
} as const;

const fontWeights = {
  normal: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

export { fontSizes, fontWeights };
