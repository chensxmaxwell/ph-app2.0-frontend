import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "@jest/globals";
import {
  PORTRAITS,
  PORTRAIT_IDS,
  portraitById,
  portraitsForGender,
} from "../src/screens/avatar/portraits";

/**
 * TestFlight 1.2 (13): Maxwell could not find 选择头像, and the only faces a
 * crafted companion could wear were the 3D cartoon and (for seeded names) the
 * old photo. Six generated portraits now ship in the bundle as selectable
 * avatars. These tests pin the catalogue the picker lists and guard the files
 * themselves: they must be the attached portraits, square-cropped for the
 * circular faces, not stand-ins.
 */

const ASSET_DIR = join(__dirname, "..", "assets", "images", "avatars");

// PNG header: 8-byte signature, then the IHDR chunk (length, type, width, height).
const pngSize = (file: string) => {
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

describe("bundled portrait catalogue", () => {
  it("lists the six attached portraits in the order they were attached", () => {
    expect(PORTRAIT_IDS).toEqual([
      "m-warm",
      "m-calm",
      "f-bangs",
      "f-long",
      "nb-short",
      "m-tousled",
    ]);
    expect(PORTRAITS.map((portrait) => portrait.id)).toEqual(PORTRAIT_IDS);
    for (const portrait of PORTRAITS) {
      expect(portrait.source).toBeTruthy();
      expect(portrait.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("tags each portrait with the gender in its file name", () => {
    expect(
      Object.fromEntries(PORTRAITS.map((portrait) => [portrait.id, portrait.gender]))
    ).toEqual({
      "m-warm": "m",
      "m-calm": "m",
      "f-bangs": "f",
      "f-long": "f",
      "nb-short": "nb",
      "m-tousled": "m",
    });
  });

  it("filters by the companion's gender: m-* for Male, f-* for Female, all six otherwise", () => {
    const ids = (gender?: string) =>
      portraitsForGender(gender).map((portrait) => portrait.id);
    expect(ids("Male")).toEqual(["m-warm", "m-calm", "m-tousled"]);
    expect(ids("Female")).toEqual(["f-bangs", "f-long"]);
    expect(ids("Non-binary")).toEqual(PORTRAIT_IDS);
    // Seeded threads store "Male"/"Female"; anything else shows everyone.
    expect(ids("male")).toEqual(["m-warm", "m-calm", "m-tousled"]);
    expect(ids(undefined)).toEqual(PORTRAIT_IDS);
    expect(ids("")).toEqual(PORTRAIT_IDS);
  });

  it("resolves a portrait id and nothing else", () => {
    expect(portraitById("m-warm")?.id).toBe("m-warm");
    expect(portraitById("f-long")?.source).toBe(
      PORTRAITS.find((portrait) => portrait.id === "f-long")?.source
    );
    expect(portraitById("look")).toBeUndefined();
    expect(portraitById("portrait")).toBeUndefined();
    expect(portraitById(undefined)).toBeUndefined();
    expect(portraitById("kevin")).toBeUndefined();
  });
});

describe("bundled portrait files", () => {
  it("are the six attached portraits, square-cropped, not placeholders", () => {
    const problems: string[] = [];
    const digests = new Set<string>();
    for (const id of PORTRAIT_IDS) {
      const file = join(ASSET_DIR, `portrait-${id}.png`);
      const { width, height } = pngSize(file);
      if (width !== height) {
        problems.push(`portrait-${id}.png is ${width}x${height}, not square`);
      }
      if (width < 256) {
        problems.push(
          `portrait-${id}.png is ${width}px wide: a stand-in, not the attached portrait`
        );
      }
      digests.add(readFileSync(file).toString("base64"));
    }
    if (digests.size !== PORTRAIT_IDS.length) {
      problems.push("the six portrait files are not all different images");
    }
    expect(problems).toEqual([]);
  });
});
