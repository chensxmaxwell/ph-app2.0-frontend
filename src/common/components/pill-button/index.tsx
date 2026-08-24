import React, { ReactNode } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { colors } from '../../styles/colors';

export const PillButton: React.FC<PillButtonProps> = ({
  onPress,
  title,
  disabled,
  style,
  textStyle,
  children,
}) => (
  <View style={styles.buttonContainer}>
    <Pressable
      onPress={onPress}
      style={[styles.pillButton, disabled && styles.pillButtonDisabled, style]}
      disabled={disabled}>
      {children || (
        <Text
          style={[
            styles.pillButtonText,
            disabled && styles.pillButtonTextDisabled,
            textStyle,
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  buttonContainer: {
    alignItems: 'center', // Center the button horizontally
    justifyContent: 'center', // Center the button vertically
  },
  pillButton: {
    borderRadius: 25, // This gives the pill shape
    paddingVertical: 10,
    elevation: 0, // For Android shadow
    borderWidth: 1,
    minWidth: 128, // Ensures the button does not shrink below this width
    width: 'auto', // Allows the button to expand based on content
  },
  pillButtonDisabled: {
    borderRadius: 25, // This gives the pill shape
    paddingVertical: 10,
    elevation: 0, // For Android shadow
    borderColor: colors.grayDisabled,
  },
  pillButtonText: {
    textAlign: 'center',
    fontSize: 16,
  },
  pillButtonTextDisabled: {
    color: colors.grayDisabled,
  },
});

export type PillButtonProps = {
  onPress?: (event?: GestureResponderEvent) => void;
  title?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: ReactNode | ReactNode[];
};
