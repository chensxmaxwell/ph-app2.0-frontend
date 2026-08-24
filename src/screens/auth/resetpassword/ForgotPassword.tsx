import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { NavigationType } from "../../../../App";
import { SimplePage } from "../../shared/simple-page";

const ForgotPasswordScreen = () => {
  const navigation = useNavigation<NavigationType>();
  const [email, setEmail] = useState("");

  return (
    <SimplePage
      title="Reset password"
      onBack={() => navigation.goBack()}
      primaryLabel="Continue"
      onPrimary={() =>
        navigation.navigate(SCREENS.VERIFY_CODE as never, { email } as never)
      }
      secondaryLabel="Cancel"
      onSecondary={() => navigation.goBack()}
    >
      <Text style={styles.copy}>
        Enter the email associated with your account. We will send a
        verification code to reset your password.
      </Text>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.grayLighter}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  copy: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
  },
  field: {
    marginTop: 32,
    backgroundColor: colors.grayLightest,
    borderRadius: 50,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  input: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});

export default ForgotPasswordScreen;
