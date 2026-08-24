import React, { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { SCREENS } from '../../common/constant/index';

const WaitingScreen = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../../assets/images/Kink/waiting.png")}
      ></Image>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default WaitingScreen;
