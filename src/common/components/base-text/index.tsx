import React from 'react';
import {
  Text,
  StyleSheet,
  TextProps,
} from 'react-native';

import { colors } from '../../styles/colors';
import { fontSizes, fontWeights } from '@common/styles/fonts';

export const BaseText: React.FC<BaseTextProps> = (prop) => {
  return (
    <Text {...prop} style={[styles.text, prop.style]} />
  );
};

const styles = StyleSheet.create({
  text: {
    color: colors.white,
    fontFamily: 'Quicksand-Bold',
    fontSize: fontSizes.small,
    fontWeight: fontWeights.normal,
  },
});

export type BaseTextProps = TextProps;