import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useFooter } from './hooks';

const gradientColors = {
  pink: { start: '#B78AAF', stop: '#FBC8D4' },
  purple: { start: '#593479', stop: '#B999D4' },
  blue: { start: '#C7DDF0', stop: '#B6D6EF' },
  grey: { start: '#9F9F9F', stop: '#F2F2F2' },
};

export const FooterWaveSvgBackground: React.FC<
  FooterWaveSvgBackgroundProps
> = ({ type = 'pink' }) => {
  const { keyboardHeight } = useFooter();

  return (
    <View style={[styles.background, { bottom: keyboardHeight }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient
            id="paint0_linear_120_151"
            x1="22"
            y1="4.04825e-05"
            x2="388.396"
            y2="84.7052"
            gradientUnits="userSpaceOnUse">
            <Stop stopColor={gradientColors[type].start} />
            <Stop offset="1" stopColor={gradientColors[type].stop} />
          </LinearGradient>
        </Defs>
        <Path
          d="M132 55C11.4797 55 -27.8282 16.1701 -33 0V134H468V45.5C454.32 42.5841 412.344 12.4855 353.886 19.4837C280.813 28.2315 282.65 55 132 55Z"
          fill="url(#paint0_linear_120_151)"
          fillOpacity="0.5"
        />
      </Svg>
    </View>
  );
};

export type FooterWaveSvgBackgroundTypes = keyof typeof gradientColors;

type FooterWaveSvgBackgroundProps = {
  type?: FooterWaveSvgBackgroundTypes;
};

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: -1,
    height: 134,
  },
});
