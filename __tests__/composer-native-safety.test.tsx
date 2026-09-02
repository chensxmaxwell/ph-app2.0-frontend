import fs from "fs";
import path from "path";
import React from "react";
import renderer, {
  act,
  ReactTestInstance,
  ReactTestRenderer,
} from "react-test-renderer";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  attachAvatarSlot,
  AvatarEngineHost,
  detachAvatarSlot,
} from "../src/screens/avatar/engine/AvatarEngineHost";
import { DEFAULT_LOOK } from "../src/screens/avatar/engine/viewer-html";

jest.mock("react-native-webview", () => ({
  WebView: "MockWebView",
}));

jest.mock("../src/native/ph-native", () => ({
  bundledAvatarViewerUrl: () =>
    "file:///avatar-engine/viewer-page.html",
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
  tree.root.findAll((node) => node.type === "MockWebView");

const trees: ReactTestRenderer[] = [];

const renderHost = () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<AvatarEngineHost />);
  });
  trees.push(tree!);
  return tree!;
};

afterEach(() => {
  act(() => {
    detachAvatarSlot(MESSAGE_SLOT_ID);
    detachAvatarSlot(ACTIVE_SLOT_ID);
    detachAvatarSlot(DETACH_SLOT_ID);
    trees.splice(0).forEach((tree) => tree.unmount());
  });
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
});
