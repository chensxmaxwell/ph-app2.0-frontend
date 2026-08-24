import React from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';


import { useSeekBarVertical } from './hooks';
import { FULL_SIZE } from '@common/constant';
import { colors } from '@common/styles/colors';

export const SeekBarVertical: React.FC<SeekBarVerticalProps> = ({
  range,
  width,
  height,
  buttonStyles,
  type,
  handleValueChange,
}) => {
  const { panResponder, types, currentPercentageDecimalReverse } =
    useSeekBarVertical({
      buttonStyles,
      height: height!,
      handleValueChange,
      range,
    });

  return (
    <View style={styles.container}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.seekbar,
          {
            width,
            height,
            borderRadius: width,
            borderWidth: 0,
          },
        ]}>
        <View style={styles.shadowContainer}>
          <LinearGradient
            colors={[
              'transparent',
              'transparent',
              colors.accentLightPink
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            locations={[
              0,
              currentPercentageDecimalReverse,
              currentPercentageDecimalReverse,
              // (1 - currentPercentageDecimalReverse) * 0.51 +
              // currentPercentageDecimalReverse,
              // (1 - currentPercentageDecimalReverse) * 0.77 +
              // currentPercentageDecimalReverse,
              // (1 - currentPercentageDecimalReverse) * 1 +
              // currentPercentageDecimalReverse,
            ]}
            style={[
              styles.indicator,
              {
                borderRadius: width,
              },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
};

SeekBarVertical.defaultProps = {
  width: 48,
  height: 372,
  type: 'pink',
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  seekbar: {
    borderWidth: 2,
    backgroundColor: colors.grayLightest,
  },
  indicator: {
    height: FULL_SIZE,
    width: FULL_SIZE,
  },
  shadowContainer: {
    shadowColor: colors.accentLightPink, // Glow color
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10, // For Android shadow effect
  },
});

export type SeekBarVerticalProps = {
  unit?: string;
  range?: { start: number; end: number };
  width?: number;
  height?: number;
  buttonStyles?: Animated.AnimatedProps<ViewStyle>;
  type?: 'pink';
  handleValueChange: (value: number) => void;
};
