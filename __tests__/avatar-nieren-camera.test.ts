import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "@jest/globals";
import {
  FALLBACK_STANDING_HEIGHT,
  prefixIndex,
  standingCameraPose,
  usableStandingHeight,
  verticalCoverage,
} from "../src/screens/avatar/engine/camera-frame";

const viewerCopies = [
  "assets/avatar-engine/viewer-page.html",
  "ios/AppFrontend/avatar-engine/viewer-page.html",
  "android/app/src/main/assets/avatar-engine/viewer-page.html",
];

const viewerHtml = () =>
  readFileSync(join(__dirname, "../assets/avatar-engine/viewer-page.html"), "utf8");

const customizeSource = readFileSync(
  join(__dirname, "../src/screens/avatar/customize.tsx"),
  "utf8"
);

describe("捏人 camera framing", () => {
  it("full-body camera looks at mid-height and covers head to shoes", () => {
    const height = 1.75;
    const pose = standingCameraPose(height);
    expect(pose.lookAtY).toBeCloseTo(height * 0.5);
    expect(pose.y).toBeCloseTo(height * 0.5);
    expect(pose.y).toBeGreaterThan(0.7);
    expect(pose.z).toBeGreaterThan(3);
    const cover = verticalCoverage(pose);
    expect(cover).toBeGreaterThanOrEqual(height);
    expect(pose.lookAtY - cover / 2).toBeLessThan(0.05);
    expect(pose.lookAtY + cover / 2).toBeGreaterThan(height);
  });

  it("does not treat the BoZo bind-pose pancake as standing height", () => {
    // Unskinned Outfit/Head verts * root (scale 0.01, rotX 90°) from bozo-male.glb
    expect(
      usableStandingHeight({ x: 0.009, y: 0.003, z: 0.018 })
    ).toBe(FALLBACK_STANDING_HEIGHT);
    expect(usableStandingHeight({ x: 0.5, y: 1.82, z: 0.3 })).toBeCloseTo(1.82);
  });

  it("pancake height still frames a full figure, not feet", () => {
    const height = usableStandingHeight({ x: 0.009, y: 0.003, z: 0.018 });
    const pose = standingCameraPose(height);
    expect(pose.lookAtY).toBeGreaterThan(0.7);
    expect(verticalCoverage(pose)).toBeGreaterThan(1.6);
  });

  it("still maps Outfit_2_top_0 / Hair_2_0_0 to slot 2", () => {
    expect(prefixIndex("Outfit_2_top_0", "Outfit_")).toBe(2);
    expect(prefixIndex("Outfit_2_bottom_0", "Outfit_")).toBe(2);
    expect(prefixIndex("Outfit_2_feet_0", "Outfit_")).toBe(2);
    expect(prefixIndex("Hair_2_0_0", "Hair_")).toBe(2);
    expect(prefixIndex("Outfit_0_top_0", "Outfit_")).toBe(0);
    expect(prefixIndex("Body_Neck", "Outfit_")).toBe(-1);
  });
});

describe("捏人 viewer HTML", () => {
  it("measures skinned vertices instead of bind-pose pancakes", () => {
    const html = viewerHtml();
    expect(html).toMatch(/isSkinnedMesh/);
    expect(html).toMatch(/boneTransform/);
    expect(html).toMatch(/usableStandingHeight/);
    expect(html).not.toMatch(/modelHeight = Math\.max\(0\.8, size\.y\)/);
  });

  it("reframes after look changes and WebView resize", () => {
    const html = viewerHtml();
    expect(html).toMatch(/frameCamera\(look\.viewMode === "bust" \? "bust" : "full"\)/);
    expect(html).toMatch(/resize\(\);\s*frameCamera/);
  });

  it("keeps all bundled viewer copies in sync", () => {
    const canonical = viewerHtml();
    viewerCopies.forEach((relative) => {
      const copy = readFileSync(join(__dirname, "..", relative), "utf8");
      expect(copy).toBe(canonical);
    });
  });
});

describe("捏人 customize steps", () => {
  it("frames a full standing figure on Hair/Face/Skin/Body/Eyes/Age", () => {
    expect(customizeSource).not.toContain('return "bust"');
    expect(customizeSource).toContain('viewMode="full"');
  });
});
