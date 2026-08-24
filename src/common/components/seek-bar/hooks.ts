import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, PanResponderGestureState } from 'react-native';

import { colors } from '../../styles/colors';

import { SeekBarProps } from '.';

const defaultButtonWidth = 48;
const types = {
  pink: {
    backgroundColor: [colors.grayLight, '#EAC7CC'],
    indicatorColor: [colors.grayLight, '#F57790'],
    borderColor: colors.grayLight,
  },
  purple: {
    backgroundColor: [colors.purpleLight, colors.purpleLight],
    indicatorColor: ['#AA75A1', colors.purpleLight],
    borderColor: colors.grayLight,
  },
};

export const useSeekBar = ({
  buttonStyles,
  width,
  handleValueChange,
  range,
}: useSeekBarProps) => {
  const [xValue, setXValue] = useState(0);
  const button = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    const id = button.x.addListener(({ value }) => setXValue(value));
    return () => button.x.removeListener(id); // Cleanup function
  }, [button.x]);

  const originalX = useRef(0);
  const buttonWidth =
    buttonStyles?.width && typeof buttonStyles.width === 'number'
      ? buttonStyles.width
      : defaultButtonWidth;

  const getNewX = (gestureState: PanResponderGestureState) => {
    return Math.max(
      Math.min(gestureState.dx + originalX.current, width - buttonWidth),
      0,
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (e, gestureState) => {
        Animated.event([null, { dx: button.x }], { useNativeDriver: false })(
          e,
          gestureState,
        );
        const newX = getNewX(gestureState);
        button.setValue({ x: newX, y: 0 });
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        button.setOffset({ x: 0, y: 0 });
        originalX.current = getNewX(gestureState);
      },
      onPanResponderTerminate: (_, gestureState) => {
        button.setOffset({ x: 0, y: 0 });
        originalX.current = getNewX(gestureState);
      },
      onShouldBlockNativeResponder: () => true,
    }),
  ).current;

  const rangeWidth = range ? range.end - range.start : 100;
  // Calculate the current value based on the button's position
  const currentValue = (
    (range ? range.start : 0) +
    (xValue / (width - buttonWidth)) * rangeWidth
  ).toFixed(0);

  useEffect(() => {
    handleValueChange(parseInt(currentValue, 10));
  }, [currentValue, handleValueChange]);

  return {
    button,
    xValue,
    panResponder,
    currentValue,
    defaultButtonWidth,
    types,
  };
};

type useSeekBarProps = Pick<
  SeekBarProps,
  'buttonStyles' | 'handleValueChange' | 'range'
> & {
  width: number;
};
