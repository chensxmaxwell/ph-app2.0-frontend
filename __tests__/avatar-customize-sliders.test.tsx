import React, { ReactNode } from "react";
import { Text, TouchableOpacity } from "react-native";
import renderer, {
  act,
  ReactTestInstance,
  ReactTestRenderer,
} from "react-test-renderer";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { CompanionsProvider } from "../src/store/companions";
import { ChatProvider } from "../src/screens/chat/store";
import { LoveSessionProvider } from "../src/screens/love/session";
import { AvatarCustomizeScreen } from "../src/screens/avatar/customize";
import {
  AvatarDraft,
  AvatarWizardProvider,
  DEFAULT_DRAFT,
  useAvatarWizard,
} from "../src/screens/avatar/context";
import type { AvatarLook } from "../src/screens/avatar/engine/viewer-html";

/**
 * The Customize step's Face tab used to carry an "Eyes" slider bound to the
 * same `eyeSize` key as the Eyes tab's "Size" slider: two controls for one
 * value on two tabs. The design director's first cut: Face is face shape
 * only (Face / Jaw / Chin); the eye lives on the Eyes tab. The face axes pack
 * (2026-09-07) adds Lip / Bridge / Brow after them, in the brief's order, on
 * their own keys - and no nose-length slider: bozo-male.glb has no such
 * morph, and "Bridge" (鼻梁) must never be labelled as length (鼻长).
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-linear-gradient", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View };
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => insets,
  };
});
jest.mock("react-native-webview", () => ({ WebView: "MockWebView" }));
// Ships untranspiled ESM; a host element keeps the props readable.
jest.mock("@miblanchard/react-native-slider", () => {
  const ReactModule = require("react");
  return {
    Slider: (props: Record<string, unknown>) =>
      ReactModule.createElement("MockSlider", props),
  };
});
jest.mock("../src/native/ph-native", () => ({
  bundledAvatarViewerUrl: () => "file:///avatar-engine/viewer-page.html",
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getParent: () => undefined,
  }),
  useIsFocused: () => true,
}));

// Distinct values per slider key, so a rendered slider's `value` prop tells
// which draft field it is bound to.
const SLIDER_VALUES: Record<
  keyof Pick<
    AvatarLook,
    | "upperArms"
    | "chest"
    | "forearms"
    | "backAndHips"
    | "faceWidth"
    | "jaw"
    | "chin"
    | "lipFullness"
    | "noseBridge"
    | "browHeight"
    | "eyeSize"
    | "age"
  >,
  number
> = {
  upperArms: 0.11,
  chest: 0.12,
  forearms: 0.13,
  backAndHips: 0.14,
  faceWidth: 0.21,
  jaw: 0.22,
  chin: 0.23,
  lipFullness: 0.24,
  noseBridge: 0.25,
  browHeight: 0.26,
  eyeSize: 0.31,
  age: 0.41,
};
const keyForValue = (value: number) => {
  const found = (
    Object.keys(SLIDER_VALUES) as Array<keyof typeof SLIDER_VALUES>
  ).find((key) => SLIDER_VALUES[key] === value);
  if (!found) {
    throw new Error(`no slider key renders value ${value}`);
  }
  return found;
};

const INITIAL_DRAFT: AvatarDraft = {
  ...DEFAULT_DRAFT,
  ...SLIDER_VALUES,
  name: "Nova",
  avatar: "look",
};

type WizardApi = ReturnType<typeof useAvatarWizard>;
let wizard: WizardApi | null = null;
const Probe = () => {
  wizard = useAvatarWizard();
  return null;
};

const Providers = ({ children }: { children: ReactNode }) => (
  <CompanionsProvider>
    <LoveSessionProvider>
      <ChatProvider>
        <AvatarWizardProvider
          mode="create"
          companionId="companion-nova"
          initialDraft={INITIAL_DRAFT}
        >
          <Probe />
          {children}
        </AvatarWizardProvider>
      </ChatProvider>
    </LoveSessionProvider>
  </CompanionsProvider>
);

const flush = async () => {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const trees: ReactTestRenderer[] = [];

const mountCustomize = async () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <Providers>
        <AvatarCustomizeScreen />
      </Providers>
    );
  });
  trees.push(tree!);
  await act(flush);
  return tree!;
};

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => React.Children.toArray(node.props.children).join(""));

const pill = (tree: ReactTestRenderer, label: string) => {
  const match = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) =>
      node
        .findAllByType(Text)
        .some(
          (text) =>
            React.Children.toArray(text.props.children).join("") === label
        )
    );
  if (!match) {
    throw new Error(`No category pill labelled ${label}`);
  }
  return match;
};

const openCategory = (tree: ReactTestRenderer, label: string) => {
  act(() => {
    pill(tree, label).props.onPress();
  });
};

const sliders = (tree: ReactTestRenderer): ReactTestInstance[] =>
  tree.root.findAll(
    (node) =>
      String(node.type) === "MockSlider" && typeof node.props.value === "number"
  );

const sliderKeys = (tree: ReactTestRenderer) =>
  sliders(tree).map((node) => keyForValue(node.props.value as number));

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  wizard = null;
});

describe("Customize: the Face tab is face shape only", () => {
  it("offers Face, Jaw, Chin, then the face axes pack Lip, Bridge, Brow — no Eyes slider", async () => {
    const tree = await mountCustomize();
    openCategory(tree, "Face");

    expect(sliderKeys(tree)).toEqual([
      "faceWidth",
      "jaw",
      "chin",
      "lipFullness",
      "noseBridge",
      "browHeight",
    ]);
    // The row labels read as face shape; "Eyes" appears once, as the tab pill.
    const labels = texts(tree);
    expect(labels).toEqual(
      expect.arrayContaining(["Face", "Jaw", "Chin", "Lip", "Bridge", "Brow"])
    );
    expect(labels.filter((label) => label === "Eyes")).toHaveLength(1);
    expect(labels).not.toContain("Size");
  });

  it("names the nose axis Bridge (鼻梁) and never Length (鼻长): the GLB has no nose-length morph", async () => {
    const tree = await mountCustomize();
    openCategory(tree, "Face");

    const labels = texts(tree);
    expect(labels).toContain("Bridge");
    labels.forEach((label) => {
      expect(label).not.toMatch(/length|鼻长|nose/i);
    });
    expect(sliderKeys(tree)).not.toContain("noseLength" as never);
  });

  it("binds Lip, Bridge and Brow to their own keys and leaves the rest of the face alone", async () => {
    const tree = await mountCustomize();
    openCategory(tree, "Face");

    const rows = sliders(tree);
    const byKey = Object.fromEntries(
      rows.map((row) => [keyForValue(row.props.value as number), row])
    );
    act(() => {
      byKey.lipFullness.props.onValueChange(0.9);
    });
    expect(wizard!.draft.lipFullness).toBe(0.9);
    act(() => {
      byKey.noseBridge.props.onValueChange(0.1);
    });
    expect(wizard!.draft.noseBridge).toBe(0.1);
    act(() => {
      byKey.browHeight.props.onValueChange([0.7]);
    });
    expect(wizard!.draft.browHeight).toBe(0.7);
    expect(wizard!.draft.faceWidth).toBe(SLIDER_VALUES.faceWidth);
    expect(wizard!.draft.jaw).toBe(SLIDER_VALUES.jaw);
    expect(wizard!.draft.chin).toBe(SLIDER_VALUES.chin);
    expect(wizard!.draft.eyeSize).toBe(SLIDER_VALUES.eyeSize);
  });

  it("keeps the Eyes tab's Size slider on the same eyeSize key", async () => {
    const tree = await mountCustomize();
    openCategory(tree, "Eyes");

    expect(sliderKeys(tree)).toEqual(["eyeSize"]);
    expect(texts(tree)).toContain("Size");

    const [size] = sliders(tree);
    act(() => {
      size.props.onValueChange(0.8);
    });
    expect(wizard!.draft.eyeSize).toBe(0.8);
    // Face shape untouched by the eye control - the brow included: Eyes Size
    // used to move the brows in the viewer; browHeight is the Face tab's now.
    expect(wizard!.draft.faceWidth).toBe(SLIDER_VALUES.faceWidth);
    expect(wizard!.draft.jaw).toBe(SLIDER_VALUES.jaw);
    expect(wizard!.draft.chin).toBe(SLIDER_VALUES.chin);
    expect(wizard!.draft.browHeight).toBe(SLIDER_VALUES.browHeight);
  });

  it("binds every look slider to exactly one tab", async () => {
    const tree = await mountCustomize();
    const seen: string[] = [];
    for (const category of ["Hair", "Face", "Skin", "Body", "Eyes", "Age"]) {
      openCategory(tree, category);
      seen.push(...sliderKeys(tree));
    }
    expect([...seen].sort()).toEqual(Object.keys(SLIDER_VALUES).sort());
    expect(new Set(seen).size).toBe(seen.length);
  });
});
