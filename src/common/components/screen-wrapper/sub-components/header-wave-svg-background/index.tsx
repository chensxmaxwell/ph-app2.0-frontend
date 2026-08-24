import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import HeaderOragneWaveSvg from '@images/header-wave-oragne-light.svg';

const headerType = {
  orangeLight: <HeaderOragneWaveSvg />,
  purple: (
    <Svg width="100%" height="100%">
      <Defs>
        <LinearGradient
          id="paint0_linear_108_2476"
          x1="-40.5"
          y1="154"
          x2="406"
          y2="63.5"
          gradientUnits="userSpaceOnUse">
          <Stop stopColor="#B78AAF" />
          <Stop offset="1" stopColor="#FBC8D4" />
        </LinearGradient>
      </Defs>
      <Path
        d="M93.5 107C29.1 98.2 -1.66667 116.667 -9 127L-15 -50H449.5V195.5C423 221 355.2 268.8 296 256C222 240 174 118 93.5 107Z"
        fill="url(#paint0_linear_108_2476)"
        fillOpacity="0.5"
      />
    </Svg>
  ),
};

export const HeaderWaveSvgBackground: React.FC<
  HeaderWaveSvgBackgroundProps
> = ({ type = 'purple' }) => {
  return <View style={styles.background}>{headerType[type]}</View>;
};

export type HeaderWaveSvgBackgroundProps = {
  type?: keyof typeof headerType;
};

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: -1,
  },
});
