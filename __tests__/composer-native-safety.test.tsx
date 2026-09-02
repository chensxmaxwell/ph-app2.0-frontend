import fs from "fs";
import path from "path";
import React from "react";
import { View } from "react-native";
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
import {
  attachAvatarSlot,
  AvatarEngineHost,
  detachAvatarSlot,
} from "../src/screens/avatar/engine/AvatarEngineHost";
import { AvatarPreview } from "../src/screens/avatar/engine/AvatarPreview";
import { DEFAULT_LOOK } from "../src/screens/avatar/engine/viewer-html";

let mockIsFocused = true;
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockIsFocused,
}));

jest.mock("react-native-webview", () => ({
  WebView: "MockWebView",
}));

jest.mock("../src/native/ph-native", () => ({
  bundledAvatarViewerUrl: () => "file:///avatar-engine/viewer-page.html",
}));

const MESSAGE_SLOT_ID = 9001;
const ACTIVE_SLOT_ID = 9002;
const DETACH_SLOT_ID = 9003;

const slot = {
  rect: { x: 0, y: 0, width: 200, height: 400 },
  look: DEFAULT_LOOK,
  viewMode: "full" as const,
  revealBody: false,
};

const mountedWebViews = (tree: ReactTestRenderer): ReactTestInstance[] =>
  tree.root.findAll((node) => String(node.type) === "MockWebView");

type MeasureCallback = (
  x: number,
  y: number,
  width: number,
  height: number
) => void;

const trees: ReactTestRenderer[] = [];
let pendingMeasure: MeasureCallback | null = null;
const measureInWindowMock = (
  View as unknown as {
    prototype: {
      measureInWindow: {
        mockImplementation: (
          callback: (measure: MeasureCallback) => void
        ) => void;
        mockReset: () => void;
      };
    };
  }
).prototype.measureInWindow;

const renderHost = () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<AvatarEngineHost />);
  });
  trees.push(tree!);
  return tree!;
};

const renderPreview = () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <AvatarPreview look={DEFAULT_LOOK} width={200} height={400} />
    );
  });
  trees.push(tree!);
  return tree!;
};

const publishMeasurement = (x = 0, y = 0, width = 200, height = 400) => {
  const callback = pendingMeasure;
  if (!callback) {
    throw new Error("Avatar preview did not request a measurement");
  }
  pendingMeasure = null;
  act(() => callback(x, y, width, height));
};

beforeEach(() => {
  measureInWindowMock.mockImplementation((callback) => {
    pendingMeasure = callback;
  });
});

afterEach(() => {
  act(() => {
    detachAvatarSlot(MESSAGE_SLOT_ID);
    detachAvatarSlot(ACTIVE_SLOT_ID);
    detachAvatarSlot(DETACH_SLOT_ID);
    for (let id = 1; id <= 100; id += 1) {
      detachAvatarSlot(id);
    }
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  pendingMeasure = null;
  mockIsFocused = true;
  measureInWindowMock.mockReset();
});

describe("keyboard-safe avatar engine lifecycle", () => {
  it("does not mount WKWebView when no avatar preview owns a slot", () => {
    detachAvatarSlot(MESSAGE_SLOT_ID);
    const tree = renderHost();

    expect(mountedWebViews(tree)).toHaveLength(0);
  });

  it("mounts WKWebView while an avatar preview owns a slot", () => {
    attachAvatarSlot(ACTIVE_SLOT_ID, slot);
    const tree = renderHost();

    expect(mountedWebViews(tree)).toHaveLength(1);
  });

  it("requires user action for any media in the active avatar WebView", () => {
    attachAvatarSlot(ACTIVE_SLOT_ID, slot);
    const tree = renderHost();
    const webView = mountedWebViews(tree)[0];

    expect(webView.props.mediaPlaybackRequiresUserAction).toBe(true);
    expect(webView.props.mediaCapturePermissionGrantType).toBe("deny");
  });

  it("releases WKWebView after the last avatar preview detaches", () => {
    attachAvatarSlot(DETACH_SLOT_ID, slot);
    const tree = renderHost();
    expect(mountedWebViews(tree)).toHaveLength(1);

    act(() => detachAvatarSlot(DETACH_SLOT_ID));

    expect(mountedWebViews(tree)).toHaveLength(0);
  });

  it("releases WKWebView when a retained avatar screen loses focus", () => {
    const host = renderHost();
    const preview = renderPreview();
    publishMeasurement();
    expect(mountedWebViews(host)).toHaveLength(1);

    mockIsFocused = false;
    act(() => {
      preview.update(
        <AvatarPreview look={DEFAULT_LOOK} width={200} height={400} />
      );
    });

    expect(mountedWebViews(host)).toHaveLength(0);
  });

  it("ignores a measurement callback delivered after preview unmount", () => {
    const host = renderHost();
    const preview = renderPreview();
    const staleMeasurement = pendingMeasure;
    expect(staleMeasurement).not.toBeNull();

    act(() => preview.unmount());
    act(() => staleMeasurement?.(0, 0, 200, 400));

    expect(mountedWebViews(host)).toHaveLength(0);
  });

  it("ignores non-finite preview measurements", () => {
    const host = renderHost();
    renderPreview();

    publishMeasurement(0, 0, Number.NaN, 400);

    expect(mountedWebViews(host)).toHaveLength(0);
  });
});

describe("composer regression contracts", () => {
  const messageSource = fs.readFileSync(
    path.join(__dirname, "../src/screens/chat/thread.tsx"),
    "utf8"
  );
  const loveSource = fs.readFileSync(
    path.join(__dirname, "../src/screens/love/chat.tsx"),
    "utf8"
  );

  it("keeps the Kevin TextInput mounted when talk mode changes", () => {
    expect(messageSource).toContain("composerHidden");
    expect(messageSource).toContain(
      'pointerEvents={talkMode ? "none" : "auto"}'
    );
    expect(messageSource).not.toMatch(/\)\s*:\s*talkMode\s*\?\s*\(/);
  });

  it.each([
    ["Kevin", messageSource],
    ["Love", loveSource],
  ])(
    "%s typing preserves native marked text and does not start voice",
    (_name, source) => {
      const changeHandler = source.match(
        /onChangeText=\{\(value\) => \{([\s\S]*?)\}\}\s*style=/
      )?.[1];

      expect(changeHandler).toContain("setDraft(value)");
      expect(changeHandler).not.toContain("sanitizeComposerText");
      expect(changeHandler).not.toContain("startVoiceInput");
      expect(changeHandler).not.toContain("stopVoiceInput");
      expect(source).toContain("sanitizeComposerText(draft)");
    }
  );

  it.each([
    [
      "Kevin",
      messageSource,
      "const submit = () => {",
      "const openListen = () => {",
      "if (editingId)",
    ],
    [
      "Love",
      loveSource,
      "const send = () => {",
      "const pageZero:",
      "patchChat(",
    ],
  ])(
    "%s send ends native editing before clearing the controlled value",
    (_name, source, startMarker, endMarker, mutationMarker) => {
      const start = source.indexOf(startMarker);
      const end = source.indexOf(endMarker, start);
      const sendHandler = source.slice(start, end);

      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      expect(sendHandler).toContain("clearSubmittedDraft();");
      expect(sendHandler).not.toContain('setDraft("");');
      expect(sendHandler.indexOf("clearSubmittedDraft();")).toBeLessThan(
        sendHandler.indexOf(mutationMarker)
      );
      expect(source).toContain("clearComposerAfterSubmit({");
      expect(source).toContain("onBlur={finishSubmittedDraftClear}");
    }
  );
});
