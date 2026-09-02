export type WizardMode = "create" | "editLook" | "editPersona";

export type AvatarStackParams = {
  mode?: WizardMode;
  companionId?: string;
};

// "identity" is the basic info page (name, gender, birthday, description).
export const CREATE_STEPS = [
  "identity",
  "ready",
  "appearance",
  "customize",
  "personality",
  "intimate",
  "candle",
] as const;

export const EDIT_LOOK_STEPS = ["appearance", "customize"] as const;

export const EDIT_PERSONA_STEPS = [
  "identity",
  "personality",
  "intimate",
] as const;

export type WizardStepKey =
  | (typeof CREATE_STEPS)[number]
  | (typeof EDIT_LOOK_STEPS)[number]
  | (typeof EDIT_PERSONA_STEPS)[number];
