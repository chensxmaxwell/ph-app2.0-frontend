import { useState, useRef, useEffect } from 'react';
import { Animated, PanResponderGestureState, PanResponder } from 'react-native';



import { SeekBarVerticalProps } from '.';
import { colors } from '@common/styles/colors';

const types = {
  pink: {
    color: [colors.neonGreen, '#EFBBC9', '#EEABBC', '#FBC1D0', '#FFD2DE'],
    borderColor: '#E9CED2',
  },
};
export const useSeekBarVertical = ({
  height,
  handleValueChange,
  range,
}: useSeekBarProps) => {
  const [yValue, setYValue] = useState(height);
  const top = 0; // Start from the bottom
  const heightOffset = height - top;
  const button = useRef(
    new Animated.ValueXY({ x: 0, y: heightOffset }),
  ).current;

  useEffect(() => {
    const id = button.y.addListener(({ value }) => setYValue(value));
    return () => button.y.removeListener(id); // Cleanup function
  }, [button.y]);

  const rangeHeight = range ? range.end - range.start : 100;

  const currentPercentageDecimal = (height - yValue) / height;
  const currentPercentageDecimalReverse = 1 - currentPercentageDecimal;
  const currentValue = (currentPercentageDecimal * rangeHeight).toFixed(0);

  useEffect(() => {
    handleValueChange(parseInt(currentValue, 10));
  }, [currentValue, handleValueChange]);

  const originalY = useRef(heightOffset);
  const getNewY = (gestureState: PanResponderGestureState) => {
    // Calculate the new Y value based on the pan gesture's movement
    const newY = originalY.current + gestureState.dy;
    // Ensure the new Y value is within the bounds of the seek bar height
    return Math.max(Math.min(newY, heightOffset), 0);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (e, gestureState) => {
        Animated.event([null, { dy: button.y }], { useNativeDriver: false })(
          e,
          gestureState,
        );
        const newY = getNewY(gestureState);
        button.setValue({ x: 0, y: newY });
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        button.setOffset({ x: 0, y: 0 });
        originalY.current = getNewY(gestureState);
      },
      onPanResponderTerminate: (_, gestureState) => {
        button.setOffset({ x: 0, y: 0 });
        originalY.current = getNewY(gestureState);
      },
      onShouldBlockNativeResponder: () => true,
    }),
  ).current;

  return { panResponder, types, currentPercentageDecimalReverse };
};

type useSeekBarProps = Pick<
  SeekBarVerticalProps,
  'buttonStyles' | 'handleValueChange' | 'range'
> & {
  height: number;
};
