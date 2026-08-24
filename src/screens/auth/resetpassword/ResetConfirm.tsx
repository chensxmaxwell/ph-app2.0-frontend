import React from "react";
import { StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { NavigationType } from "../../../../App";
import { SimplePage } from "../../shared/simple-page";

const ResetConfirmScreen = () => {
  const navigation = useNavigation<NavigationType>();

  const goLogin = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: SCREENS.LOGIN }],
    });

  return (
    <SimplePage
      title="Reset password"
      hideBack
      primaryLabel="Login"
      onPrimary={goLogin}
      secondaryLabel="Cancel"
      onSecondary={goLogin}
    >
      <Text style={styles.copy}>Yay! Your password has been reset.</Text>
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  copy: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
    marginTop: 180,
  },
});

export default ResetConfirmScreen;
