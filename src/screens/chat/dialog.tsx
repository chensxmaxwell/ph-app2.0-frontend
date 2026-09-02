import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "@common/styles/colors";
import { s } from "../avatar/scale";

// In-screen confirm used by the Message thread (leave / listen blocked) and
// the Message list (delete friend). Rendered last inside the screen so it
// paints over everything; not a Modal on purpose, to match the chat chrome.
export const Dialog = ({
  title,
  body,
  primary,
  secondary,
  onPrimary,
  onSecondary,
  destructive,
  testID,
}: {
  title: string;
  body: string;
  primary: string;
  secondary: string;
  onPrimary: () => void;
  onSecondary: () => void;
  destructive?: boolean;
  testID?: string;
}) => (
  <View style={styles.dialogScrim} testID={testID}>
    <View style={styles.dialog}>
      <Text style={styles.dialogTitle}>{title}</Text>
      <Text style={styles.dialogBody}>{body}</Text>
      <TouchableOpacity
        style={[
          styles.dialogPrimary,
          destructive ? styles.dialogPrimaryDestructive : null,
        ]}
        onPress={onPrimary}
        testID={testID ? `${testID}-primary` : undefined}
      >
        <Text style={styles.dialogPrimaryText}>{primary}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onSecondary}
        testID={testID ? `${testID}-secondary` : undefined}
      >
        <Text style={styles.dialogSecondary}>{secondary}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// Same red as the Alarm list's swipe-to-delete; shared with the Message
// list's Delete friend action so the confirm button matches it.
export const DESTRUCTIVE_RED = "#f95f6e";

const styles = StyleSheet.create({
  dialogScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(40),
    zIndex: 10,
  },
  dialog: {
    width: "100%",
    borderRadius: s(20),
    backgroundColor: "#3b3850",
    padding: s(24),
    alignItems: "center",
    gap: s(12),
  },
  dialogTitle: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  dialogBody: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  dialogPrimary: {
    marginTop: s(8),
    width: "100%",
    height: s(50),
    borderRadius: s(25),
    backgroundColor: colors.grayLightSolid,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogPrimaryDestructive: {
    backgroundColor: DESTRUCTIVE_RED,
  },
  dialogPrimaryText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  dialogSecondary: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
});
