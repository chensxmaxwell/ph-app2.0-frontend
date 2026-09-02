import React, {
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { Companion } from "../../store/companions";
import {
  AvatarLook,
  CHARACTER_PRESETS,
  DEFAULT_LOOK,
  pickLook,
} from "./engine/viewer-html";
import { WizardMode } from "./types";

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

export const DEFAULT_DRAFT: AvatarDraft = {
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

export const toGenderOption = (value: string): GenderOption => {
  switch (value) {
    case "Male":
    case "Female":
    case "Non-binary":
      return value;
    default:
      return "Male";
  }
};

export const toPersonalityOptions = (values: string[]): PersonalityOption[] =>
  values.filter((item): item is PersonalityOption =>
    (PERSONALITY_OPTIONS as readonly string[]).includes(item)
  );

export const draftFromCompanion = (companion: Companion): AvatarDraft => ({
  ...pickLook(companion),
  name: companion.name,
  birthday: companion.birthday,
  gender: toGenderOption(companion.gender),
  personalities: toPersonalityOptions(companion.personalities),
  story: companion.story,
  passionateTender: companion.passionateTender,
  dominantSubmissive: companion.dominantSubmissive,
  experimentalVanilla: companion.experimentalVanilla,
});

type AvatarWizardContextValue = {
  draft: AvatarDraft;
  // What the wizard opened with; lets a save tell edits from untouched defaults.
  baseline: AvatarDraft;
  mode: WizardMode;
  companionId: string;
  patchDraft: (patch: Partial<AvatarDraft>) => void;
  restoreBaseline: () => void;
  resetDraft: () => void;
  isDirty: boolean;
};

const AvatarWizardContext = createContext<AvatarWizardContextValue | null>(
  null
);

export const AvatarWizardProvider = ({
  children,
  mode,
  companionId,
  initialDraft,
}: {
  children: ReactNode;
  mode: WizardMode;
  companionId: string;
  initialDraft: AvatarDraft;
}) => {
  const baselineRef = useRef(initialDraft);
  const [draft, setDraft] = useState<AvatarDraft>(initialDraft);

  const patchDraft = (patch: Partial<AvatarDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const restoreBaseline = () => {
    setDraft(baselineRef.current);
  };

  const isDirty = isDraftDirty(draft, baselineRef.current);

  const value = useMemo(
    () => ({
      draft,
      baseline: baselineRef.current,
      mode,
      companionId,
      patchDraft,
      restoreBaseline,
      resetDraft: restoreBaseline,
      isDirty,
    }),
    [companionId, draft, isDirty, mode]
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

export const lookFromDraft = (draft: AvatarDraft): AvatarLook =>
  pickLook(draft);

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

export const samePersonalities = (
  left: readonly PersonalityOption[],
  right: readonly PersonalityOption[]
): boolean =>
  left.length === right.length &&
  left.every((item, index) => item === right[index]);

const isDraftDirty = (draft: AvatarDraft, baseline: AvatarDraft): boolean => {
  const lookKeys = Object.keys(AVATAR_LOOK_FIELDS) as Array<keyof AvatarLook>;
  if (lookKeys.some((key) => draft[key] !== baseline[key])) {
    return true;
  }

  const extraKeys = Object.keys(DRAFT_ONLY_FIELDS) as DraftOnlyKey[];
  for (const key of extraKeys) {
    switch (key) {
      case "name":
      case "birthday":
        if (draft[key].trim() !== baseline[key].trim()) {
          return true;
        }
        break;
      case "gender":
      case "story":
        if (draft[key] !== baseline[key]) {
          return true;
        }
        break;
      case "personalities":
        if (!samePersonalities(draft.personalities, baseline.personalities)) {
          return true;
        }
        break;
      case "passionateTender":
      case "dominantSubmissive":
      case "experimentalVanilla":
        if (draft[key] !== baseline[key]) {
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
