import React, { ReactNode } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

import { fontSizes, fontWeights } from '../../styles/fonts';

import { SvgBackground } from './sub-components/svg-background';

export const PillButtonSvg: React.FC<PillButtonSvgProps> = ({
  onPress,
  text,
  disabled,
  textStyle,
  type,
  height,
  width,
  children,
}) => {
  return (
    <Pressable
      style={[
        styles.button,
        {
          height,
          width,
        },
      ]}
      disabled={disabled}
      onPress={onPress}>
      <SvgBackground type={type} height={height} width={width} />
      <View style={styles.textWrapper}>
        {children || <Text style={[styles.text, textStyle]}>{text}</Text>}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    position: 'relative',
  },
  textWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  text: {
    fontWeight: fontWeights.semiBold,
    fontSize: fontSizes.medium,
    position: 'relative',
    left: '-50%',
    top: '-50%',
    color: 'white',
  },
});

export type PillButtonSvgProps = {
  onPress?: (event?: GestureResponderEvent) => void;
  text?: string;
  disabled?: boolean;
  textStyle?: StyleProp<TextStyle>;
  type: 'red' | 'pink' | 'pink-light' | 'purple';
  width: number;
  height: number;
  children?: ReactNode | ReactNode[];
};
