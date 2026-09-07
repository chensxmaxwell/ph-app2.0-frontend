// Mirrored verbatim in assets/avatar-engine/viewer-page.html (the 3D viewer
// cannot import this module); __tests__/avatar-viewer-rig.test.ts fails if
// the two drift. Style C (soft semi-real intimate, 2026-09-06): swatch 1 of
// hair is a soft dark brown (was the #5c3310 orange chestnut) and swatch 1 of
// skin a peach with pink under it (was the #e2b089 tan) - both are the
// default look's picks.
export const HAIR_COLORS = [
  "#1a1410",
  "#55392a",
  "#d4b483",
  "#8b2a1a",
  "#e891b0",
  "#d0d0d0",
] as const;

export const SKIN_COLORS = [
  "#f3d0bc",
  "#e4b696",
  "#c17a45",
  "#8a4f28",
] as const;

export const EYE_COLORS = [
  "#3a2418",
  "#3f6b3a",
  "#2e4d7a",
  "#5a3a1e",
  "#111111",
] as const;

export const HAIR_STYLE_COUNT = 4;

export type HairStyleIndex = 0 | 1 | 2 | 3;

export type AvatarLook = {
  appearanceIndex: number;
  hairStyle: HairStyleIndex | number;
  hairColor: number;
  skinTone: number;
  eyeColor: number;
  upperArms: number;
  chest: number;
  forearms: number;
  backAndHips: number;
  faceWidth: number;
  jaw: number;
  chin: number;
  // Face axes pack (design brief 2026-09-07), each one honest morph on Head_0:
  // lipFullness = Shape_MouthThin reversed (0 thin, 1 the base mesh's full
  // lip), noseBridge = Shape_NoseBridgeCurve (0 the base bridge, 1 the full
  // curve), browHeight = Shape_LowerBrows below 0.5 / Shape_RaiseBrows above
  // it (0.5 = the base brow). There is NO nose-length axis: bozo-male.glb has
  // no Shape_NoseLength (only NoseWidth / NoseTiltUp / NoseTiltDown /
  // NoseBridgeCurve), and the tilt morphs must not stand in for length - a
  // real length target is a future morph.
  lipFullness: number;
  noseBridge: number;
  browHeight: number;
  eyeSize: number;
  age: number;
};

export type FaceAxisKey = "lipFullness" | "noseBridge" | "browHeight";

// Design defaults for the face axes pack: lip 0.55 / bridge 0.50 / brow 0.50.
// Also what a companion saved before the pack opens on (see pickLook).
export const FACE_AXIS_DEFAULTS: Record<FaceAxisKey, number> = {
  lipFullness: 0.55,
  noseBridge: 0.5,
  browHeight: 0.5,
};

// A look record as persisted before the face axes pack: no lip / bridge /
// brow keys. `AvatarLook` itself is assignable to it.
export type StoredAvatarLook = Omit<AvatarLook, FaceAxisKey> &
  Partial<Pick<AvatarLook, FaceAxisKey>>;

const axisOr = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const CHARACTER_PRESETS: AvatarLook[] = [
  {
    appearanceIndex: 0,
    hairStyle: 0,
    hairColor: 0,
    skinTone: 0,
    eyeColor: 0,
    upperArms: 0.28,
    chest: 0.32,
    forearms: 0.32,
    backAndHips: 0.34,
    faceWidth: 0.28,
    jaw: 0.3,
    chin: 0.42,
    lipFullness: 0.55,
    noseBridge: 0.5,
    browHeight: 0.5,
    eyeSize: 0.58,
    age: 0.18,
  },
  {
    appearanceIndex: 1,
    hairStyle: 1,
    hairColor: 1,
    skinTone: 1,
    eyeColor: 3,
    upperArms: 0.58,
    chest: 0.62,
    forearms: 0.52,
    backAndHips: 0.6,
    faceWidth: 0.58,
    jaw: 0.55,
    chin: 0.5,
    lipFullness: 0.55,
    noseBridge: 0.5,
    browHeight: 0.5,
    eyeSize: 0.52,
    age: 0.32,
  },
  // The default look (DEFAULT_LOOK). Style C: Face / Jaw sit lower on the
  // same mild sculpt axes (caps 0.45 / 0.45 / 0.50 unchanged) for a softer
  // oval than the #41 default's 0.48 / 0.46, which the raised caps had made
  // squarer and sterner than the reviewed bust; chin as signed off; Eyes
  // Size 0.5 = the locked 0.85 eye. Body mids (design-signed, body posture
  // pass 2026-09-07): arms 0.58 / 0.55, chest 0.55, back & hips 0.56 - the
  // #42 0.45 / 0.45 / 0.50 / 0.48 read as a flat, sexless torso next to the
  // Style C body sheet; the viewer's hips mapping was widened with them.
  // Lip / Bridge / Brow at the brief's 0.55 / 0.50 / 0.50 (FACE_AXIS_DEFAULTS).
  {
    appearanceIndex: 2,
    hairStyle: 2,
    hairColor: 1,
    skinTone: 1,
    eyeColor: 0,
    upperArms: 0.58,
    chest: 0.55,
    forearms: 0.55,
    backAndHips: 0.56,
    faceWidth: 0.4,
    jaw: 0.38,
    chin: 0.5,
    lipFullness: 0.55,
    noseBridge: 0.5,
    browHeight: 0.5,
    eyeSize: 0.5,
    age: 0.28,
  },
  {
    appearanceIndex: 3,
    hairStyle: 3,
    hairColor: 4,
    skinTone: 2,
    eyeColor: 0,
    upperArms: 0.68,
    chest: 0.72,
    forearms: 0.62,
    backAndHips: 0.74,
    faceWidth: 0.66,
    jaw: 0.64,
    chin: 0.58,
    lipFullness: 0.55,
    noseBridge: 0.5,
    browHeight: 0.5,
    eyeSize: 0.44,
    age: 0.22,
  },
];

export const DEFAULT_LOOK: AvatarLook = CHARACTER_PRESETS[2];

// A companion persisted before the face axes pack has no lip / bridge / brow;
// it opens on the design defaults, never on 0 (which the viewer would read as
// thin lips under heavy low brows).
export const pickLook = (source: StoredAvatarLook): AvatarLook => ({
  appearanceIndex: source.appearanceIndex,
  hairStyle: source.hairStyle,
  hairColor: source.hairColor,
  skinTone: source.skinTone,
  eyeColor: source.eyeColor,
  upperArms: source.upperArms,
  chest: source.chest,
  forearms: source.forearms,
  backAndHips: source.backAndHips,
  faceWidth: source.faceWidth,
  jaw: source.jaw,
  chin: source.chin,
  lipFullness: axisOr(source.lipFullness, FACE_AXIS_DEFAULTS.lipFullness),
  noseBridge: axisOr(source.noseBridge, FACE_AXIS_DEFAULTS.noseBridge),
  browHeight: axisOr(source.browHeight, FACE_AXIS_DEFAULTS.browHeight),
  eyeSize: source.eyeSize,
  age: source.age,
});
