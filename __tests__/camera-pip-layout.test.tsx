import React from "react";
import { UIManager } from "react-native";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
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
import { CameraPreview } from "../src/screens/call/camera-preview";

/**
 * Maxwell, TestFlight 1.2 (19): Camera / Microphone / Speech all ON, PR #37's
 * polling and shared session queue on board, and the PiP was still 「不行」.
 *
 * The native view was being laid out 0×0. RN (Paper) flattens `style` and the
 * component's own props into ONE payload for UIManager, and a later key
 * overwrites an earlier one; the base `RCTViewManager` also exports a Yoga
 * *shadow* prop named `position` (absolute / relative). `PHCameraPreview`
 * exported a view prop with the very same name for the camera side, so the
 * payload carried `position: "front"` instead of the style's `absolute`,
 * `RCTConvert` fell back to `relative` (an RCTLogInfo in Debug, silence in
 * Release), and a relative child with no size inside a centred frame has no
 * size at all. An `AVCaptureVideoPreviewLayer` with no bounds paints nothing
 * — whether or not the session runs, whether or not `previewing` flips.
 *
 * These tests run the PiP's real host props through RN's own attribute
 * payload code (the Paper bridge's) and read the native manager as source.
 */

// RN's Paper prop flattening: what the bridge hands UIManager for one view.
// Flow-typed JS in node_modules, so required with a cast.
const { create: createAttributePayload } =
  require("react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload") as {
    create: (
      props: object,
      validAttributes: object
    ) => Record<string, unknown> | null;
  };
const styleAttributes =
  require("react-native/Libraries/Components/View/ReactNativeStyleAttributes") as Record<
    string,
    unknown
  >;

const EXPORTED_PROP =
  /RCT_EXPORT_(?:VIEW|SHADOW)_PROPERTY\((\w+),\s*([\w ]+)\)/g;

const exportedProps = (source: string): Record<string, string> =>
  Object.fromEntries(
    Array.from(source.matchAll(EXPORTED_PROP)).map(([, name, type]) => [
      name,
      type.trim(),
    ])
  );

const phNative = readFileSync(
  join(__dirname, "../ios/AppFrontend/PHNative.mm"),
  "utf8"
);
const cameraManager = phNative.slice(
  phNative.indexOf("@implementation PHCameraPreviewManager")
);
const cameraProps = exportedProps(cameraManager);

// The base view manager every RCTViewManager subclass inherits: its view
// props and its Yoga shadow (layout) props are all valid top-level
// attributes of every native view.
const baseManager = readFileSync(
  join(__dirname, "../node_modules/react-native/React/Views/RCTViewManager.m"),
  "utf8"
);
const baseProps = exportedProps(baseManager);

// As getNativeComponentAttributes builds them: one entry per native prop
// (none of ours needs a differ or a processor), plus the style attributes.
const validAttributes = {
  ...Object.fromEntries(
    [...Object.keys(baseProps), ...Object.keys(cameraProps)].map((name) => [
      name,
      true,
    ])
  ),
  style: styleAttributes,
};

const getConfig = UIManager.getViewManagerConfig as jest.Mock;
const trees: ReactTestRenderer[] = [];

beforeEach(() => {
  getConfig.mockReturnValue({});
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  getConfig.mockReset();
});

const hostProps = (): Record<string, unknown> => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CameraPreview />);
  });
  trees.push(tree!);
  const [host] = tree!.root.findAll(
    (node) => String(node.type) === CAMERA_PREVIEW_VIEW
  );
  return Object.fromEntries(
    Object.entries(host.props as Record<string, unknown>).filter(
      ([name]) => name !== "children"
    )
  );
};

describe("the PiP's native view gets the frame's whole box from Yoga", () => {
  it("RN's base view manager owns `position` as a Yoga layout prop (the name our camera prop collided with)", () => {
    expect(baseProps.position).toBe("YGPositionType");
    expect(Object.keys(styleAttributes)).toContain("position");
  });

  it("no camera prop shares its name with a style attribute or a base view-manager prop", () => {
    const collisions = Object.keys(cameraProps).filter(
      (name) => name in styleAttributes || name in baseProps
    );
    expect(collisions).toEqual([]);
    // The camera side still has a name of its own, and the JS passes it.
    expect(cameraProps.facing).toBe("NSString");
    expect(cameraProps.position).toBeUndefined();
  });

  it("the payload the bridge sends keeps `position: absolute` from the style, with the camera side beside it", () => {
    const payload = createAttributePayload(hostProps(), validAttributes);
    expect(payload).not.toBeNull();
    // Yoga: absolute + all four edges = the parent's whole box.
    expect(payload!.position).toBe("absolute");
    expect(payload!.top).toBe(0);
    expect(payload!.left).toBe(0);
    expect(payload!.right).toBe(0);
    expect(payload!.bottom).toBe(0);
    expect(payload!.facing).toBe("front");
    // Events travel as `true` markers.
    expect(payload!.onStatusChange).toBe(true);
  });

  it("every prop the JS passes to the native view is one the native manager exports (no silent drop, no stray override)", () => {
    const passed = Object.keys(hostProps()).filter((name) => name !== "style");
    const unexported = passed.filter((name) => !(name in cameraProps));
    expect(unexported).toEqual([]);
  });
});
