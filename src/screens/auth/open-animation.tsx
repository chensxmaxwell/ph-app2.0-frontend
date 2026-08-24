import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { colors } from "@common/styles/colors";

export const OpenAnimationScreen = () => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#2B2358", "#2B2358"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["#5E5DBF", "rgba(50, 41, 105, 0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={styles.brand}>Pleasure House</Text>
      <Image
        source={require("../../../assets/images/logos/PHlogo.png")}
        style={styles.logo}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: colors.white,
    fontFamily: "AngryPortraitToumpano",
    fontSize: 32,
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
});
