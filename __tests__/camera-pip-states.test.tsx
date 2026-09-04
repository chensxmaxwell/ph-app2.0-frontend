import React from "react";
import { Text, TouchableOpacity, UIManager } from "react-native";
import renderer, {
  act,
  ReactTestInstance,
  ReactTestRenderer,
} from "react-test-renderer";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";
import { CAMERA_PREVIEW_VIEW } from "../src/native/camera-preview";
import {
  CAMERA_INTERRUPTED_COPY,
  CAMERA_NO_FRAMES_COPY,
  CAMERA_STALLED_COPY,
  CAMERA_START_TIMEOUT_MS,
  CAMERA_STARTING_COPY,
  CameraPreview,
} from "../src/screens/call/camera-preview";

/**
 * Maxwell, TestFlight 1.2 (18): Camera, Microphone and Speech Recognition all
 * ON in Settings, and the video PiP still failed (black / "Starting camera…"
 * / stalled). Not a permission problem, so every other way the preview can
 * fail has to end in copy that says which half failed, plus Retry — never a
 * silent black box. The native side is read here as source: its `running`
 * must not hang on a KVO notification Apple does not promise, a replacement
 * view must never start a second session on the camera while the first is
 * still stopping, and an interruption must say why.
 */

const getConfig = UIManager.getViewManagerConfig as jest.Mock;
const trees: ReactTestRenderer[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  getConfig.mockReturnValue({});
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  getConfig.mockReset();
  jest.useRealTimers();
});

const texts = (root: ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map((node) => React.Children.toArray(node.props.children).join(""));

const hosts = (root: ReactTestInstance) =>
  root.findAll((node) => String(node.type) === CAMERA_PREVIEW_VIEW);

const retryButton = (root: ReactTestInstance) =>
  root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.testID === "call-camera-retry");

const mount = () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CameraPreview />);
  });
  trees.push(tree!);
  return tree!;
};

const report = (root: ReactTestInstance, status: string, message = "") => {
  act(() => {
    hosts(root)[0].props.onStatusChange({ nativeEvent: { status, message } });
  });
};

describe("the video PiP is never a silent black box", () => {
  it("an interruption shows the native side's reason and offers Retry, which remounts the view", () => {
    const tree = mount();
    const [first] = hosts(tree.root);

    report(
      tree.root,
      "interrupted",
      "Camera is in use by another app or session."
    );

    expect(texts(tree.root)).toContain(
      "Camera is in use by another app or session."
    );
    expect(texts(tree.root)).not.toContain(CAMERA_INTERRUPTED_COPY);
    expect(retryButton(tree.root)).toBeDefined();

    act(() => {
      retryButton(tree.root)!.props.onPress();
    });
    expect(texts(tree.root)).toContain(CAMERA_STARTING_COPY);
    expect(hosts(tree.root)).toHaveLength(1);
    expect(hosts(tree.root)[0]).not.toBe(first);
  });

  it("an interruption with no reason keeps the generic copy, still with Retry", () => {
    const tree = mount();
    report(tree.root, "interrupted");
    expect(texts(tree.root)).toContain(CAMERA_INTERRUPTED_COPY);
    expect(retryButton(tree.root)).toBeDefined();
  });

  it("a failure shows the native side's message and offers Retry", () => {
    const tree = mount();
    report(tree.root, "unavailable", "Camera is on but not drawing (96×128).");

    expect(texts(tree.root)).toContain(
      "Camera is on but not drawing (96×128)."
    );
    expect(retryButton(tree.root)).toBeDefined();
  });

  it("a stall before the session was even configured says the camera didn't start", () => {
    const tree = mount();
    act(() => {
      jest.advanceTimersByTime(CAMERA_START_TIMEOUT_MS + 50);
    });
    expect(texts(tree.root)).toContain(CAMERA_STALLED_COPY);
    expect(texts(tree.root)).not.toContain(CAMERA_NO_FRAMES_COPY);
    expect(retryButton(tree.root)).toBeDefined();
  });

  it("a stall after the session was configured says the camera is on but not drawing — a different failure", () => {
    const tree = mount();
    report(tree.root, "authorized");
    expect(texts(tree.root)).toContain(CAMERA_STARTING_COPY);

    act(() => {
      jest.advanceTimersByTime(CAMERA_START_TIMEOUT_MS + 50);
    });
    expect(texts(tree.root)).toContain(CAMERA_NO_FRAMES_COPY);
    expect(texts(tree.root)).not.toContain(CAMERA_STALLED_COPY);
    expect(CAMERA_NO_FRAMES_COPY).not.toBe(CAMERA_STALLED_COPY);
    expect(retryButton(tree.root)).toBeDefined();
  });

  it("a first frame that arrives after the stall was reported clears the copy without a Retry", () => {
    const tree = mount();
    report(tree.root, "authorized");
    act(() => {
      jest.advanceTimersByTime(CAMERA_START_TIMEOUT_MS + 50);
    });
    expect(texts(tree.root)).toContain(CAMERA_NO_FRAMES_COPY);

    report(tree.root, "running");
    expect(texts(tree.root)).toEqual([]);
    expect(hosts(tree.root)).toHaveLength(1);
  });
});

describe("PHCameraPreviewView (source) starts a preview that paints when the camera is authorized", () => {
  const source = readFileSync(
    join(__dirname, "../ios/AppFrontend/PHNative.mm"),
    "utf8"
  );
  const camera = source.slice(
    source.indexOf("Front camera picture-in-picture")
  );

  it("does not hang `running` on KVO of `previewing`: the flag is polled after startRunning until frames render", () => {
    // Apple documents `isPreviewing` as observable through the connection's
    // `isEnabled`, not on its own. 1.2 (18): Camera authorized, PiP never
    // cleared its copy — `running` had nothing to fire it.
    expect(camera).toContain("isPreviewing");
    expect(camera).toContain("pollFrames");
    expect(camera).toContain("dispatch_after(");
    expect(camera).toContain("PHCameraFramePollInterval");
    expect(camera).toContain('emitStatus:@"running"');
  });

  it("says which half failed when a running session never draws, with the layer's size, instead of leaving JS to guess", () => {
    expect(camera).toContain("PHCameraFirstFrameTimeout");
    expect(camera).toContain("Camera is on but not drawing");
    expect(camera).toContain("Camera didn't start.");
    expect(camera).toContain("has no room to draw");
  });

  it("runs every preview view on one shared serial queue, so a replacement view starts only after the old session has stopped", () => {
    // Two AVCaptureSessions on the same camera interrupt each other
    // (VideoDeviceInUseByAnotherClient) and the survivor is often black.
    // Retry, Video off→on and a re-entered call all replace the view.
    expect(camera).toContain("PHCameraSessionQueue()");
    expect(camera).toContain("dispatch_once");
    expect(camera.match(/dispatch_queue_create\(/g) ?? []).toHaveLength(1);
    expect(camera).not.toContain("_sessionQueue");
  });

  it("reads the interruption reason and turns it into copy", () => {
    expect(camera).toContain("AVCaptureSessionInterruptionReasonKey");
    expect(camera).toContain(
      "AVCaptureSessionInterruptionReasonVideoDeviceInUseByAnotherClient"
    );
    expect(camera).toContain(
      "AVCaptureSessionInterruptionReasonVideoDeviceNotAvailableInBackground"
    );
    expect(camera).toContain(
      "AVCaptureSessionInterruptionReasonVideoDeviceNotAvailableWithMultipleForegroundApps"
    );
    expect(camera).toContain(
      "AVCaptureSessionInterruptionReasonVideoDeviceNotAvailableDueToSystemPressure"
    );
  });

  it("starts from layoutSubviews too, restarts after a media-services reset, and never adds an audio input", () => {
    expect(camera).toContain("- (void)layoutSubviews");
    expect(camera).toContain("AVErrorMediaServicesWereReset");
    expect(camera).toContain(
      "automaticallyConfiguresApplicationAudioSession = NO"
    );
    expect(camera).not.toContain("AVMediaTypeAudio");
    // Whether the view wants frames replaces a flag set around our own stop.
    expect(camera).toContain("_wantsRunning");
    expect(camera).not.toContain("_stoppedByUs");
  });
});
