import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { writeSessionUser } from "../../backend/session";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { NavigationType } from "../../../App";
import { SimplePage } from "../shared/simple-page";

const rootOf = (navigation: NavigationType) => {
  let current = navigation;
  let parent = navigation.getParent();
  while (parent) {
    current = parent;
    parent = current.getParent();
  }
  return current;
};

export const SwitchAccountsScreen = () => {
  const navigation = useNavigation<NavigationType>();

  const addAccount = async () => {
    await writeSessionUser(null);
    rootOf(navigation).reset({
      index: 0,
      routes: [{ name: SCREENS.AUTH }],
    });
  };

  return (
    <SimplePage title="Switch accounts" onBack={() => navigation.goBack()}>
      <View style={styles.card}>
        <Text style={styles.name}>Current account</Text>
        <Text style={styles.email}>Signed in on this device</Text>
      </View>
      <TouchableOpacity style={styles.add} onPress={addAccount}>
        <Text style={styles.addText}>Use another account</Text>
        <Text style={styles.addHint}>Signs out of this device</Text>
      </TouchableOpacity>
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    backgroundColor: colors.grayLightest,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  name: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  email: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  add: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  addHint: {
    marginTop: 4,
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 12,
  },
});
