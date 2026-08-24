import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Stop, RadialGradient, Circle } from 'react-native-svg';

export const RadialButton: React.FC<RadioButtonProps> = ({ height, width }) => {
  return (
    <View
      style={[
        styles.container,
        {
          height,
          width,
        },
      ]}>
      <Svg height="110%" width="110%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#FFF0F2" />
          </RadialGradient>
        </Defs>
          <Circle cx="50%" cy="50%" r="45%" fill="url(#grad)" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F3F3F3', 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 1, 
    shadowRadius: 10, 
    elevation: 5, 
  },
  
});

type RadioButtonProps = {
  height: number;
  width: number;
};
