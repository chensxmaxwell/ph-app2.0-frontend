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

// What the native view reports through onStatusChange:
// - authorized: permission granted and the capture session is configured;
//   frames are not on screen yet.
// - running: AVCaptureSession started delivering (the PiP shows the user).
// - interrupted: the system paused the camera (another client, background,
//   system pressure); `running` follows when the interruption ends.
// - denied: camera permission refused (or restricted).
// - unavailable: no camera, or the session failed to start (message says why).
export type CameraPreviewStatus =
  | "authorized"
  | "running"
  | "interrupted"
  | "denied"
  | "unavailable";

export type CameraPreviewStatusEvent = {
  nativeEvent: { status: CameraPreviewStatus; message?: string };
};

// Which camera. Named `facing`, not `position`: RN flattens `style` and the
// component's own props into one payload and the base view manager already
// owns `position` as the Yoga layout prop (absolute / relative), so a camera
// prop of that name overwrote the style's `absolute` with "front" and the
// view was laid out 0×0 (TestFlight 1.2 (15)–(19); landmine 29). Never name a
// native prop after a style attribute — `__tests__/camera-pip-layout.test.tsx`
// fails on any collision.
export type CameraFacing = "front" | "back";

export type NativeCameraPreviewProps = ViewProps & {
  facing?: CameraFacing;
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
