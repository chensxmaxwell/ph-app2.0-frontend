export const HAIR_COLORS = [
  "#1a1410",
  "#5c3310",
  "#d4b483",
  "#8b2a1a",
  "#e891b0",
  "#d0d0d0",
] as const;

export const SKIN_COLORS = [
  "#f6d7c3",
  "#e8b896",
  "#c68642",
  "#8d5524",
] as const;

export const EYE_COLORS = [
  "#2c1a0e",
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
  eyeSize: number;
  age: number;
};

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
    eyeSize: 0.52,
    age: 0.32,
  },
  {
    appearanceIndex: 2,
    hairStyle: 2,
    hairColor: 1,
    skinTone: 1,
    eyeColor: 0,
    upperArms: 0.45,
    chest: 0.5,
    forearms: 0.45,
    backAndHips: 0.48,
    faceWidth: 0.48,
    jaw: 0.46,
    chin: 0.5,
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
    eyeSize: 0.44,
    age: 0.22,
  },
];

export const DEFAULT_LOOK: AvatarLook = CHARACTER_PRESETS[2];

export const pickLook = (source: AvatarLook): AvatarLook => ({
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
  eyeSize: source.eyeSize,
  age: source.age,
});
