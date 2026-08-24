import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useConnectionPill } from "./hook";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { spacings } from "@common/styles/spacings";

export const ConnectionPill: React.FC<ConnectionPillProps> = () => {
  const { connectStatus, toggleDevice, connecting, battery } = useConnectionPill();

  return (
    <TouchableOpacity
      onPress={() => toggleDevice()}
      style={styles.connectionStatus}
    >
      <View
        style={[
          styles.connection,
          connectStatus ? styles.connected : styles.disconnected,
        ]}
      />
      <Text style={styles.connectionText}>
        {connecting
          ? "Connecting..."
          : connectStatus
          ? `Connected  ${battery}%`
          : "Disconnected"}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  connectionStatus: {
    flexDirection: "row",
    width: "auto",
    alignSelf: "center",
    minHeight: 40,
    minWidth: 150,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: colors.white,
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: spacings.w16,
    paddingVertical: spacings.h12,
    backgroundColor: colors.grayLightest,
  },
  connection: {
    height: 7,
    width: 7,
    borderRadius: 5,
    marginRight: 10,
  },
  connectionText: {
    color: colors.white,
    fontSize: fontSizes.smallX,
    fontWeight: fontWeights.bold,
  },
  connected: {
    backgroundColor: colors.neonGreen,
  },
  disconnected: {
    backgroundColor: "red",
  },
});

export type ConnectionPillProps = {};
