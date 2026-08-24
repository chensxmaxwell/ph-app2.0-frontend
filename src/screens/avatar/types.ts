export type WizardMode = "create" | "editLook" | "editPersona";

export type AvatarStackParams = {
  mode?: WizardMode;
  companionId?: string;
};

export const CREATE_STEPS = [
  "identity",
  "ready",
  "appearance",
  "customize",
  "personality",
  "story",
  "intimate",
  "candle",
] as const;

export const EDIT_LOOK_STEPS = ["appearance", "customize"] as const;

export const EDIT_PERSONA_STEPS = [
  "identity",
  "personality",
  "story",
  "intimate",
] as const;

export type WizardStepKey =
  | (typeof CREATE_STEPS)[number]
  | (typeof EDIT_LOOK_STEPS)[number]
  | (typeof EDIT_PERSONA_STEPS)[number];
