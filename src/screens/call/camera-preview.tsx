import React, { useMemo, useState } from "react";
import {
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { colors } from "@common/styles/colors";
import {
  CameraPreviewStatus,
  nativeCameraPreview,
} from "../../native/camera-preview";
import { s } from "../avatar/scale";

export const CAMERA_DENIED_COPY =
  "Camera access is needed for video. Allow it in Settings.";
export const CAMERA_UNAVAILABLE_COPY =
  "Camera preview isn't available on this build.";
const NO_CAMERA_COPY = "No camera on this device.";

type CameraPreviewProps = {
  style?: StyleProp<ViewStyle>;
};

// The user's front camera as a picture-in-picture. Video only: the native
// view never adds an audio input, so the voice loop keeps AVAudioSession.
export const CameraPreview = ({ style }: CameraPreviewProps) => {
  const Native = useMemo(() => nativeCameraPreview(), []);
  const [status, setStatus] = useState<CameraPreviewStatus | "starting">(
    "starting"
  );
  const [message, setMessage] = useState("");

  if (!Native) {
    return (
      <View style={[styles.frame, style]} testID="call-camera-pip">
        <Text style={styles.copy}>{CAMERA_UNAVAILABLE_COPY}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, style]} testID="call-camera-pip">
      <Native
        style={styles.fill}
        position="front"
        onStatusChange={(event) => {
          setStatus(event.nativeEvent.status);
          setMessage(event.nativeEvent.message ?? "");
        }}
      />
      {status === "denied" ? (
        <View style={styles.overlay}>
          <Text style={styles.copy}>{CAMERA_DENIED_COPY}</Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings().catch(() => undefined)}
            style={styles.settings}
            hitSlop={8}
          >
            <Text style={styles.settingsText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {status === "unavailable" ? (
        <View style={styles.overlay}>
          <Text style={styles.copy}>{message || NO_CAMERA_COPY}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: s(96),
    height: s(128),
    borderRadius: s(16),
    overflow: "hidden",
    backgroundColor: "rgba(20, 16, 40, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(243, 243, 243, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 16, 40, 0.85)",
    padding: s(8),
    gap: s(8),
  },
  copy: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: s(6),
  },
  settings: {
    paddingHorizontal: s(10),
    height: s(26),
    borderRadius: s(13),
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 11,
  },
});
