import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it } from "@jest/globals";
import {
  QuickBlissContext,
  useAppContext,
} from "../src/screens/quick_bliss/quick-bliss-context";
import {
  DeepDiscoverContext,
  useDeepDiscoverContext,
} from "../src/screens/deep_discovery/deep-discover-context";

const TimerDurationProbe = ({
  useDuration,
}: {
  useDuration: () => { time: number };
}) => {
  const { time } = useDuration();
  return React.createElement(Text, null, time * 60);
};

describe.each([
  {
    name: "Quick Bliss",
    Provider: QuickBlissContext,
    useDuration: useAppContext,
  },
  {
    name: "Deep Discovery",
    Provider: DeepDiscoverContext,
    useDuration: useDeepDiscoverContext,
  },
])("$name timer", ({ Provider, useDuration }) => {
  it("initializes the visible 15-minute selection as 900 seconds", () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        React.createElement(
          Provider,
          null,
          React.createElement(TimerDurationProbe, { useDuration })
        )
      );
    });

    expect(tree?.root.findByType(Text).props.children).toBe(15 * 60);

    act(() => {
      tree?.unmount();
    });
  });
});
