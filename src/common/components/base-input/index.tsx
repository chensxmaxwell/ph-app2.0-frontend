import React from 'react';
import {
  Text,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { colors } from '../../styles/colors';

export const BaseInput: React.FC<BaseInputProps> = props => {
  const { label } = props;
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput style={styles.input} {...props} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  label: {
    marginBottom: 10,
  },
  input: {
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    backgroundColor: 'transparent', // Ensures no box around the input field
    textAlignVertical: 'top', // Aligns text to the top
    paddingBottom: 8,
  },
});

export type BaseInputProps = TextInputProps & {
  label?: string;
};
