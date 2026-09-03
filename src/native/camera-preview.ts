import type { ComponentType } from "react";
import {
  Platform,
  requireNativeComponent,
  UIManager,
  ViewProps,
} from "react-native";

// The front-camera picture-in-picture on a video call, hosted by
// PHCameraPreviewManager in ios/AppFrontend/PHNative.mm (AVCaptureSession +
// AVCaptureVideoPreviewLayer, video input only, so it never configures the
// AVAudioSession the voice loop is using).
export const CAMERA_PREVIEW_VIEW = "PHCameraPreview";

export type CameraPreviewStatus = "authorized" | "denied" | "unavailable";

export type CameraPreviewStatusEvent = {
  nativeEvent: { status: CameraPreviewStatus; message?: string };
};

export type NativeCameraPreviewProps = ViewProps & {
  position?: "front" | "back";
  onStatusChange?: (event: CameraPreviewStatusEvent) => void;
};

// requireNativeComponent registers a view config once per name and throws on
// a second registration, so the component is created at most once.
let Native: ComponentType<NativeCameraPreviewProps> | null = null;

// A build whose native side has no PHCameraPreview (Android, or an iOS binary
// older than the view manager) must never reach requireNativeComponent: the
// missing view throws at render and an uncaught JS error in Release is
// RCTFatal (landmine 11). UIManager knows what the binary registered.
export const cameraPreviewAvailable = (): boolean => {
  if (Platform.OS !== "ios") {
    return false;
  }
  try {
    return UIManager.getViewManagerConfig(CAMERA_PREVIEW_VIEW) != null;
  } catch {
    return false;
  }
};

export const nativeCameraPreview =
  (): ComponentType<NativeCameraPreviewProps> | null => {
    if (!cameraPreviewAvailable()) {
      return null;
    }
    if (!Native) {
      Native = requireNativeComponent<NativeCameraPreviewProps>(
        CAMERA_PREVIEW_VIEW
      );
    }
    return Native;
  };
