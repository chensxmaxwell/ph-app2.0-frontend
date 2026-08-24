import React from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { FULL_SIZE } from '@common/constant';

import { useSeekBar } from './hooks';
import { RadialButton } from './sub-components/radio-button';

export const SeekBar: React.FC<SeekBarProps> = ({
  unit,
  range,
  width = 360,
  height = 48,
  buttonStyles,
  type = 'purple',
  handleValueChange,
}) => {
  const {
    button,
    currentValue,
    panResponder,
    xValue,
    defaultButtonWidth,
    types,
  } = useSeekBar({
    buttonStyles,
    width: width!,
    handleValueChange,
    range,
  });
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F3F3F34D', '#F3F3F34D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.seekbar,
          {
            width,
            height,
            borderRadius: height,
            borderColor: types[type!].borderColor,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.indicator,
          {
            width: button.x,
            borderRadius: height,
          },
        ]}>
        <LinearGradient
          colors={['#8C60B2', '#CCA0DD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderTopLeftRadius: height, 
            borderBottomLeftRadius: height, 
            width: xValue + height!,
            height,
          }}
        />
        <Animated.View
          style={[
            styles.button,
            buttonStyles,
            {
              transform: [{ translateX: button.x }],
            },
          ]}
          {...panResponder.panHandlers}>
          <RadialButton
            width={defaultButtonWidth}
            height={defaultButtonWidth}
          />
        </Animated.View>
        {/* Display the current value above the button */}
        {/* {range && (
          <Animated.Text
            style={[
              styles.valueText,
              {
                transform: [{ translateX: xValue + 2 }], // Move the text along with the button
              },
            ]}
            numberOfLines={1}>
            <Text style={styles.valueText}>{currentValue}</Text>
            {unit && <Text style={styles.unitText}>{` ${unit}`}</Text>}
          </Animated.Text>
        )} */}
      </Animated.View>
      {/* Display the start and end range text below the seek bar */}
      {range && (
        <View
          style={[
            styles.rangeTextWrapper,
            {
              top: height! + 10,
            },
          ]}>
          {/* <Text>{range.start}</Text> */}
          {unit && <Text style={[styles.startRangeUnitText]}>{unit}</Text>}
        </View>
      )}
      {range && (
        <View
          style={[
            styles.rangeTextWrapper,
            styles.endRangeTextWrapper,
            {
              top: height! + 10,
            },
          ]}>
          {/* <Text>{range.end}</Text> */}
          {unit && <Text style={[styles.startRangeUnitText]}>{unit}</Text>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seekbar: {
    borderWidth: 0,
  },
  indicator: {
    position: 'absolute',
    height: FULL_SIZE,
  },
  button: {
    position: 'absolute',
  },
  valueText: {
    width: 50,
    position: 'absolute',
    top: -33, // Adjust this value to position the text above the button
  },
  unitText: {
    width: 50,
    fontSize: 8,
    position: 'absolute',
    top: -33, // Adjust this value to position the text above the button
  },
  rangeTextWrapper: {
    width: 50,
    position: 'absolute',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  endRangeTextWrapper: {
    right: 0,
  },
  startRangeUnitText: {
    fontSize: 8,
  },
});

export type SeekBarProps = {
  unit?: string;
  range?: { start: number; end: number };
  width?: number;
  height?: number;
  buttonStyles?: Animated.AnimatedProps<ViewStyle>;
  type?: 'pink' | 'purple';
  handleValueChange: (value: number) => void;
};
