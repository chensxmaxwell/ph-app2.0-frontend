import React, {
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import { AvatarLook, CHARACTER_PRESETS, DEFAULT_LOOK, pickLook } from "./engine/viewer-html";

export const PERSONALITY_OPTIONS = [
  "Loyal & protective",
  "Playful & whimsical",
  "Gentle & nurturing",
  "Wise & thoughtful",
  "Mysterious & alluring",
] as const;

export const GENDER_OPTIONS = ["Male", "Female", "Non-binary"] as const;

export const APPEARANCE_COUNT = 4;

export type PersonalityOption = (typeof PERSONALITY_OPTIONS)[number];
export type GenderOption = (typeof GENDER_OPTIONS)[number];

export type AvatarDraft = AvatarLook & {
  name: string;
  birthday: string;
  gender: GenderOption;
  personalities: PersonalityOption[];
  story: string;
  passionateTender: number;
  dominantSubmissive: number;
  experimentalVanilla: number;
};

const DEFAULT_DRAFT: AvatarDraft = {
  ...DEFAULT_LOOK,
  name: "",
  birthday: "",
  gender: "Male",
  personalities: ["Loyal & protective", "Wise & thoughtful"],
  story: "",
  passionateTender: 0.5,
  dominantSubmissive: 0.5,
  experimentalVanilla: 0.5,
};

type AvatarWizardContextValue = {
  draft: AvatarDraft;
  patchDraft: (patch: Partial<AvatarDraft>) => void;
  resetDraft: () => void;
  isDirty: boolean;
};

const AvatarWizardContext = createContext<AvatarWizardContextValue | null>(
  null
);

export const AvatarWizardProvider = ({ children }: { children: ReactNode }) => {
  const [draft, setDraft] = useState<AvatarDraft>(DEFAULT_DRAFT);

  const patchDraft = (patch: Partial<AvatarDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const resetDraft = () => {
    setDraft(DEFAULT_DRAFT);
  };

  const isDirty = isDraftDirty(draft);

  const value = useMemo(
    () => ({ draft, patchDraft, resetDraft, isDirty }),
    [draft, isDirty]
  );

  return (
    <AvatarWizardContext.Provider value={value}>
      {children}
    </AvatarWizardContext.Provider>
  );
};

export const useAvatarWizard = () => {
  const context = useContext(AvatarWizardContext);
  if (!context) {
    throw new Error("useAvatarWizard must be used within AvatarWizardProvider");
  }
  return context;
};

export const lookFromDraft = (draft: AvatarDraft): AvatarLook => pickLook(draft);

export const applyCharacterPreset = (index: number): AvatarLook =>
  pickLook(CHARACTER_PRESETS[index] ?? DEFAULT_LOOK);

const AVATAR_LOOK_FIELDS: Record<keyof AvatarLook, true> = {
  appearanceIndex: true,
  hairStyle: true,
  hairColor: true,
  skinTone: true,
  eyeColor: true,
  upperArms: true,
  chest: true,
  forearms: true,
  backAndHips: true,
  faceWidth: true,
  jaw: true,
  chin: true,
  eyeSize: true,
  age: true,
};

type DraftOnlyKey = Exclude<keyof AvatarDraft, keyof AvatarLook>;

const DRAFT_ONLY_FIELDS: Record<DraftOnlyKey, true> = {
  name: true,
  birthday: true,
  gender: true,
  personalities: true,
  story: true,
  passionateTender: true,
  dominantSubmissive: true,
  experimentalVanilla: true,
};

const isDraftDirty = (draft: AvatarDraft): boolean => {
  const lookKeys = Object.keys(AVATAR_LOOK_FIELDS) as Array<keyof AvatarLook>;
  if (lookKeys.some((key) => draft[key] !== DEFAULT_DRAFT[key])) {
    return true;
  }

  const extraKeys = Object.keys(DRAFT_ONLY_FIELDS) as DraftOnlyKey[];
  for (const key of extraKeys) {
    switch (key) {
      case "name":
      case "birthday":
        if (draft[key].trim() !== DEFAULT_DRAFT[key].trim()) {
          return true;
        }
        break;
      case "gender":
      case "story":
        if (draft[key] !== DEFAULT_DRAFT[key]) {
          return true;
        }
        break;
      case "personalities":
        if (
          draft.personalities.length !== DEFAULT_DRAFT.personalities.length ||
          draft.personalities.some(
            (item, index) => item !== DEFAULT_DRAFT.personalities[index]
          )
        ) {
          return true;
        }
        break;
      case "passionateTender":
      case "dominantSubmissive":
      case "experimentalVanilla":
        if (draft[key] !== DEFAULT_DRAFT[key]) {
          return true;
        }
        break;
      default: {
        const exhaustive: never = key;
        return exhaustive;
      }
    }
  }

  return false;
};
