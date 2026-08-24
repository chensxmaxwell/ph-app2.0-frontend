import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { PillButtonSvgProps } from '../..';
import { colors } from '../../../../../common/styles/colors';

export const SvgBackground: React.FC<PinkBackgroundProps> = ({
  width,
  height,
  type,
}) => {
  const pillWidth = width; // Adjust the width as needed
  const pillHeight = height; // Adjust the height as needed
  const cornerRadius = height / 2; // Adjust the corner radius as needed

  const pathData = `
  M ${cornerRadius},0
  L ${pillWidth - cornerRadius},0
  A ${cornerRadius},${cornerRadius} 0 0 1 ${
    pillWidth - cornerRadius
  },${pillHeight}
  L ${cornerRadius},${pillHeight}
  A ${cornerRadius},${cornerRadius} 0 0 1 ${cornerRadius},0
  Z
`;

  const typeColor: typeColorType = {
    pink: {
      start: '#DF6692',
      stop: '#FBB2CC',
    },
    'pink-light': {
      start: '#FEF7F8',
      stop: '#F1B4BC',
      startOpacity: 0.85,
      stopOpacity: 0.95,
      x1: '0%',
      y1: '0%',
      x2: '0%',
      y2: '100%',
    },
    red: {
      start: colors.pink,
      stop: '#F36D83',
    },
    purple: {
      start: '#C7649C',
      stop: '#F1B0D5',
    },
  };

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient
          id="paint0_linear_703_472"
          x1={typeColor[type].x1 || '0%'}
          y1={typeColor[type].y1 || '100%'}
          x2={typeColor[type].x2 || '100%'}
          y2={typeColor[type].y2 || '0%'}
          gradientUnits="userSpaceOnUse">
          <Stop
            stopColor={typeColor[type].start}
            stopOpacity={typeColor[type].startOpacity}
          />
          <Stop
            offset="1"
            stopColor={typeColor[type].stop}
            stopOpacity={typeColor[type].stopOpacity}
          />
        </LinearGradient>
      </Defs>

      <Path d={pathData} fill="url(#paint0_linear_703_472)" />
    </Svg>
  );
};

type PinkBackgroundProps = Pick<
  PillButtonSvgProps,
  'type' | 'width' | 'height'
>;

type typeColorType = Record<
  PinkBackgroundProps['type'],
  {
    start: string;
    stop: string;
    startOpacity?: number;
    stopOpacity?: number;
    x1?: string;
    y1?: string;
    x2?: string;
    y2?: string;
  }
>;
