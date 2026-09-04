import React from "react";
import { Text, UIManager } from "react-native";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  CAMERA_PREVIEW_VIEW,
  cameraPreviewAvailable,
  nativeCameraPreview,
} from "../src/native/camera-preview";
import { CameraPreview } from "../src/screens/call/camera-preview";

/**
 * `requireNativeComponent("PHCameraPreview")` on a build whose native side
 * does not register the view (Android, or an iOS binary older than the
 * view manager) throws at render, and an uncaught JS error in Release is
 * RCTFatal → the process quits (landmine 11). The preview must ask UIManager
 * first and fall back to copy.
 */

const getConfig = UIManager.getViewManagerConfig as jest.Mock;
const trees: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  getConfig.mockReset();
});

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => React.Children.toArray(node.props.children).join(""));

describe("camera preview availability gate", () => {
  it("reports unavailable and hands back no component when UIManager has no PHCameraPreview", () => {
    getConfig.mockReturnValue(undefined);
    expect(cameraPreviewAvailable()).toBe(false);
    expect(nativeCameraPreview()).toBeNull();
    expect(getConfig).toHaveBeenCalledWith(CAMERA_PREVIEW_VIEW);
  });

  it("renders the unavailable copy instead of the native view on such a build", () => {
    getConfig.mockReturnValue(undefined);
    let tree: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<CameraPreview />);
    });
    trees.push(tree!);

    expect(
      tree!.root.findAll((node) => String(node.type) === CAMERA_PREVIEW_VIEW)
    ).toHaveLength(0);
    expect(texts(tree!).join("\n")).toMatch(/Camera .*isn't available/);
  });

  it("mounts the registered native view once the view manager is present", () => {
    getConfig.mockReturnValue({});
    expect(cameraPreviewAvailable()).toBe(true);
    let tree: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<CameraPreview />);
    });
    trees.push(tree!);

    const hosts = tree!.root.findAll(
      (node) => String(node.type) === CAMERA_PREVIEW_VIEW
    );
    expect(hosts).toHaveLength(1);
    expect(hosts[0].props.facing).toBe("front");
  });
});
