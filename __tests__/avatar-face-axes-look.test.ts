import { describe, expect, it } from "@jest/globals";
import {
  AvatarLook,
  CHARACTER_PRESETS,
  DEFAULT_LOOK,
  FACE_AXIS_DEFAULTS,
  StoredAvatarLook,
  pickLook,
} from "../src/screens/avatar/engine/viewer-html";
import { DEFAULT_DRAFT, draftFromCompanion } from "../src/screens/avatar/context";
import { companionFromDraft } from "../src/screens/avatar/persist";
import type { Companion } from "../src/store/companions";

/**
 * Face axes pack (design brief 2026-09-07): lipFullness -> noseBridge ->
 * browHeight on the look, defaults 0.55 / 0.50 / 0.50, persisted with the
 * companion like every other Face axis. A companion saved before the pack
 * carries none of the three keys and must open on the defaults - the viewer
 * reads a missing number as 0, which would be thin lips under heavy low brows.
 */

const FACE_AXES = ["lipFullness", "noseBridge", "browHeight"] as const;

const legacyLook = (): StoredAvatarLook => {
  const { lipFullness, noseBridge, browHeight, ...rest } = DEFAULT_LOOK;
  void lipFullness;
  void noseBridge;
  void browHeight;
  return rest;
};

describe("face axes on the look", () => {
  it("defaults to lip 0.55 / bridge 0.50 / brow 0.50 on the default look and the draft", () => {
    expect(FACE_AXIS_DEFAULTS).toEqual({
      lipFullness: 0.55,
      noseBridge: 0.5,
      browHeight: 0.5,
    });
    FACE_AXES.forEach((key) => {
      expect(DEFAULT_LOOK[key]).toBe(FACE_AXIS_DEFAULTS[key]);
      expect(DEFAULT_DRAFT[key]).toBe(FACE_AXIS_DEFAULTS[key]);
    });
  });

  it("every preset carries the three axes as numbers in 0..1, and no preset has a nose-length key", () => {
    CHARACTER_PRESETS.forEach((preset) => {
      FACE_AXES.forEach((key) => {
        expect(typeof preset[key]).toBe("number");
        expect(preset[key]).toBeGreaterThanOrEqual(0);
        expect(preset[key]).toBeLessThanOrEqual(1);
      });
      expect(Object.keys(preset)).not.toContain("noseLength");
    });
  });

  it("pickLook copies the axes through and round-trips them into the companion record", () => {
    const look: AvatarLook = {
      ...DEFAULT_LOOK,
      lipFullness: 0.2,
      noseBridge: 0.9,
      browHeight: 0.75,
    };
    expect(pickLook(look)).toEqual(look);
    const companion = companionFromDraft("c1", {
      ...DEFAULT_DRAFT,
      ...look,
      name: "Nova",
    });
    expect(companion.lipFullness).toBe(0.2);
    expect(companion.noseBridge).toBe(0.9);
    expect(companion.browHeight).toBe(0.75);
    expect(draftFromCompanion(companion)).toMatchObject({
      lipFullness: 0.2,
      noseBridge: 0.9,
      browHeight: 0.75,
    });
  });

  it("a companion saved before the pack opens on the defaults, not on 0", () => {
    const stored = legacyLook();
    expect(stored).not.toHaveProperty("lipFullness");
    const picked = pickLook(stored);
    expect(picked.lipFullness).toBe(0.55);
    expect(picked.noseBridge).toBe(0.5);
    expect(picked.browHeight).toBe(0.5);
    // The rest of the look is untouched.
    expect(picked.faceWidth).toBe(DEFAULT_LOOK.faceWidth);
    expect(picked.eyeSize).toBe(DEFAULT_LOOK.eyeSize);
    // A stored NaN / null (a half-written record) falls back the same way; a
    // real 0 is kept - it is a legitimate slider position.
    expect(
      pickLook({ ...stored, lipFullness: NaN, browHeight: 0 } as StoredAvatarLook)
    ).toMatchObject({ lipFullness: 0.55, noseBridge: 0.5, browHeight: 0 });
    const companion = {
      ...stored,
      id: "old",
      name: "Kevin",
      birthday: "",
      gender: "Male",
      personalities: [],
      story: "",
      passionateTender: 0.5,
      dominantSubmissive: 0.5,
      experimentalVanilla: 0.5,
    } as unknown as Companion;
    expect(draftFromCompanion(companion)).toMatchObject(FACE_AXIS_DEFAULTS);
  });
});
