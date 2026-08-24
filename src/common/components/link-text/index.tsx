import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

import { fontSizes } from '../../styles/fonts';

export const LinkText: React.FC<LinkTextProps> = ({
  text,
  onPress,
  color = 'blue',
  size = fontSizes.small,
}) => {
  const handlePress = () => {
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text style={{ ...styles.linkText, color, fontSize: size }}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  linkText: {
    textDecorationLine: 'underline',
  },
});

type LinkTextProps = {
  text: string;
  onPress: () => void;
  color?: string;
  size?: number;
};
