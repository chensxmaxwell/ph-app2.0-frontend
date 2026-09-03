import type { ImageSourcePropType } from "react-native";

// The six generated portraits bundled as selectable avatars, in the order
// Maxwell attached them. Any companion can wear one; the create wizard offers
// them next to the 3D look. Do not add stock photos here: a seeded person's
// own photo is `portraitPresetForId` in ../chat/faces.ts.
export const PORTRAIT_IDS = [
  "m-warm",
  "m-calm",
  "f-bangs",
  "f-long",
  "nb-short",
  "m-tousled",
] as const;

export type PortraitId = (typeof PORTRAIT_IDS)[number];

// Gender tag from the file name; drives the wizard's filter (Male sees m-*,
// Female sees f-*, everyone else sees all six).
export type PortraitGender = "m" | "f" | "nb";

export type Portrait = {
  id: PortraitId;
  label: string;
  gender: PortraitGender;
  source: ImageSourcePropType;
};

export const PORTRAITS: readonly Portrait[] = [
  {
    id: "m-warm",
    label: "Warm",
    gender: "m",
    source: require("../../../assets/images/avatars/portrait-m-warm.png"),
  },
  {
    id: "m-calm",
    label: "Calm",
    gender: "m",
    source: require("../../../assets/images/avatars/portrait-m-calm.png"),
  },
  {
    id: "f-bangs",
    label: "Bangs",
    gender: "f",
    source: require("../../../assets/images/avatars/portrait-f-bangs.png"),
  },
  {
    id: "f-long",
    label: "Long hair",
    gender: "f",
    source: require("../../../assets/images/avatars/portrait-f-long.png"),
  },
  {
    id: "nb-short",
    label: "Short hair",
    gender: "nb",
    source: require("../../../assets/images/avatars/portrait-nb-short.png"),
  },
  {
    id: "m-tousled",
    label: "Tousled",
    gender: "m",
    source: require("../../../assets/images/avatars/portrait-m-tousled.png"),
  },
];

export const portraitById = (id?: string): Portrait | undefined =>
  PORTRAITS.find((portrait) => portrait.id === id);

const portraitGenderFor = (gender?: string): PortraitGender | null => {
  switch ((gender ?? "").trim().toLowerCase()) {
    case "male":
      return "m";
    case "female":
      return "f";
    default:
      return null;
  }
};

// Male → m-*, Female → f-*; Non-binary, unknown or unset → all six.
export const portraitsForGender = (gender?: string): Portrait[] => {
  const tag = portraitGenderFor(gender);
  return PORTRAITS.filter((portrait) => tag === null || portrait.gender === tag);
};
