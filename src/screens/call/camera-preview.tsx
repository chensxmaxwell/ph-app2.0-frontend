import React, { useEffect, useMemo, useState } from "react";
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

export const CAMERA_STARTING_COPY = "Starting camera…";
export const CAMERA_DENIED_COPY =
  "Camera access is needed for video. Allow it in Settings.";
export const CAMERA_UNAVAILABLE_COPY =
  "Camera preview isn't available on this build.";
// The native view never said a word: the session was not even configured.
export const CAMERA_STALLED_COPY = "Camera didn't start.";
// The session was configured and started, and no frame reached the layer:
// a different failure, so it reads differently.
export const CAMERA_NO_FRAMES_COPY = "Camera is on but not drawing.";
export const CAMERA_INTERRUPTED_COPY = "Camera paused by the system.";
const NO_CAMERA_COPY = "No camera on this device.";
// How long the PiP waits for the native session to report `running` before
// it stops pretending a black rectangle is a camera. The native view has its
// own, shorter watch (PHCameraFirstFrameTimeout) that says which half failed;
// this is the fallback for a view that never reported at all.
export const CAMERA_START_TIMEOUT_MS = 6000;

// `starting`: mounted, no word from the native view yet. `stalled`: neither
// frames nor a failure arrived in time.
type PipStatus = CameraPreviewStatus | "starting" | "stalled";

type CameraPreviewProps = {
  style?: StyleProp<ViewStyle>;
};

const Failure = ({ copy, onRetry }: { copy: string; onRetry: () => void }) => (
  <>
    <Text style={styles.copy}>{copy}</Text>
    <TouchableOpacity
      testID="call-camera-retry"
      onPress={onRetry}
      style={styles.button}
      hitSlop={8}
    >
      <Text style={styles.buttonText}>Retry</Text>
    </TouchableOpacity>
  </>
);

// The user's front camera as a picture-in-picture. Video only: the native
// view never adds an audio input, so the voice loop keeps AVAudioSession.
// Every state but `running` carries copy, and every failure carries Retry —
// on TestFlight 1.2 (14) the PiP was an empty dark box with nothing to say
// why, and on 1.2 (18) it failed with the camera authorized in Settings, so
// the copy has to say which half failed. The native view's own words win.
export const CameraPreview = ({ style }: CameraPreviewProps) => {
  const Native = useMemo(() => nativeCameraPreview(), []);
  const [status, setStatus] = useState<PipStatus>("starting");
  const [message, setMessage] = useState("");
  // Whether the native view got as far as a configured session this attempt.
  const [configured, setConfigured] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const waiting = status === "starting" || status === "authorized";
  useEffect(() => {
    if (!waiting) {
      return;
    }
    const timer = setTimeout(() => {
      setStatus("stalled");
    }, CAMERA_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [attempt, waiting]);

  if (!Native) {
    return (
      <View style={[styles.frame, style]} testID="call-camera-pip">
        <Text style={styles.copy}>{CAMERA_UNAVAILABLE_COPY}</Text>
      </View>
    );
  }

  const retry = () => {
    setMessage("");
    setConfigured(false);
    setStatus("starting");
    setAttempt((current) => current + 1);
  };

  const overlay = (): React.ReactNode => {
    switch (status) {
      case "running":
        return null;
      case "starting":
      case "authorized":
        return <Text style={styles.copy}>{CAMERA_STARTING_COPY}</Text>;
      case "interrupted":
        return (
          <Failure copy={message || CAMERA_INTERRUPTED_COPY} onRetry={retry} />
        );
      case "stalled":
        return (
          <Failure
            copy={configured ? CAMERA_NO_FRAMES_COPY : CAMERA_STALLED_COPY}
            onRetry={retry}
          />
        );
      case "denied":
        return (
          <>
            <Text style={styles.copy}>{CAMERA_DENIED_COPY}</Text>
            <TouchableOpacity
              onPress={() => Linking.openSettings().catch(() => undefined)}
              style={styles.button}
              hitSlop={8}
            >
              <Text style={styles.buttonText}>Open Settings</Text>
            </TouchableOpacity>
          </>
        );
      case "unavailable":
        return <Failure copy={message || NO_CAMERA_COPY} onRetry={retry} />;
      default: {
        const exhaustive: never = status;
        return exhaustive;
      }
    }
  };
  const content = overlay();

  return (
    <View style={[styles.frame, style]} testID="call-camera-pip">
      <Native
        key={attempt}
        style={styles.fill}
        position="front"
        onStatusChange={(event) => {
          const next = event.nativeEvent.status;
          if (next === "authorized") {
            setConfigured(true);
          }
          setStatus((previous) =>
            // "Configured" arriving after frames already paint changes
            // nothing; only a real state change may cover a live preview.
            previous === "running" && next === "authorized" ? previous : next
          );
          setMessage(event.nativeEvent.message ?? "");
        }}
      />
      {content ? <View style={styles.overlay}>{content}</View> : null}
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
  button: {
    paddingHorizontal: s(10),
    height: s(26),
    borderRadius: s(13),
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 11,
  },
});
