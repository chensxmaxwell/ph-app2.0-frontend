import { describe, expect, it } from "@jest/globals";
import React from "react";
import { Text } from "react-native";
import renderer from "react-test-renderer";
import WaveformAdjustable from "../src/screens/sound/Wave";

describe("Sound Sensitivity waveform", () => {
  it("shows the live mapped percent instead of a stuck 100%", () => {
    const tree = renderer.create(
      <WaveformAdjustable sensitivityPct={24} />
    );
    const labels = tree.root.findAllByType(Text).map((node) => {
      const { children } = node.props;
      return Array.isArray(children) ? children.join("") : String(children);
    });
    expect(labels).toContain("Sensitivity");
    expect(labels).toContain("24%");
    expect(labels).not.toContain("100%");
  });
});
