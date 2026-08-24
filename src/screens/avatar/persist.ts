import { Companion } from "../../store/companions";
import { AvatarDraft, lookFromDraft } from "./context";

export const companionFromDraft = (
  id: string,
  draft: AvatarDraft
): Companion => ({
  id,
  name: draft.name.trim() || "Kevin",
  birthday: draft.birthday,
  gender: draft.gender,
  personalities: draft.personalities,
  story: draft.story,
  passionateTender: draft.passionateTender,
  dominantSubmissive: draft.dominantSubmissive,
  experimentalVanilla: draft.experimentalVanilla,
  ...lookFromDraft(draft),
});
