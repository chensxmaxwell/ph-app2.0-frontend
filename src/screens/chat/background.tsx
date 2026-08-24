import React, { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";

export const ChatGradient = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) => (
  <LinearGradient
    colors={["#5E5DB9", "#2A2659"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={[styles.fill, style]}
  >
    {children}
  </LinearGradient>
);

export const ChatHeaderBar = ({ children }: { children: ReactNode }) => (
  <View style={styles.header}>{children}</View>
);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
