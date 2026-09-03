import type { ImageSourcePropType } from "react-native";
import type { AvatarLook } from "./engine/viewer-html";
import { Companion, lookFromCompanion } from "../../store/companions";
import { faceSourceForId, portraitPresetForId } from "../chat/faces";
import type { AvatarChoice, ChatKind, ChatThread } from "../chat/types";

// The one face a person shows everywhere. Render it with
// `<LookFace look={face.look} fallbackSource={face.source} />`: the SVG look
// when `look` is set, otherwise the portrait (or stock) image in `source`.
export type CompanionFace = {
  kind: AvatarChoice;
  look: AvatarLook | null;
  source: ImageSourcePropType;
};

export type AvatarOption = {
  kind: AvatarChoice;
  label: string;
  face: CompanionFace;
};

export const AVATAR_OPTION_LABELS: Record<AvatarChoice, string> = {
  look: "3D avatar",
  portrait: "Photo",
};

// Dialog-style verbs for switching to the other option (Love chat "···").
export const AVATAR_SWITCH_LABELS: Record<AvatarChoice, string> = {
  look: "Use 3D avatar",
  portrait: "Use photo",
};

export type FaceInput = {
  // Person id when there is no thread yet (a companion record on its own, or
  // an id nothing is stored for).
  id?: string;
  kind?: ChatKind;
  thread?: ChatThread;
  companion?: Companion;
  // Overrides the thread's stored pick; used by the picker to preview.
  choice?: AvatarChoice;
};

const lookFace = (
  look: AvatarLook,
  stock: ImageSourcePropType
): CompanionFace => ({ kind: "look", look, source: stock });

const portraitFace = (source: ImageSourcePropType): CompanionFace => ({
  kind: "portrait",
  look: null,
  source,
});

// What this person could wear: the crafted look when a companion record
// exists, and the bundled photo when the person is a seeded one. A person with
// neither still gets a face from `companionFace` (the stock fallback) but has
// nothing to pick between.
export const avatarOptions = ({
  id,
  kind,
  thread,
  companion,
}: FaceInput): AvatarOption[] => {
  const personId = thread?.id ?? id;
  const stock = faceSourceForId(personId, thread?.kind ?? kind);
  const options: AvatarOption[] = [];
  if (companion) {
    options.push({
      kind: "look",
      label: AVATAR_OPTION_LABELS.look,
      face: lookFace(lookFromCompanion(companion), stock),
    });
  }
  const portrait = portraitPresetForId(personId);
  if (portrait) {
    options.push({
      kind: "portrait",
      label: AVATAR_OPTION_LABELS.portrait,
      face: portraitFace(portrait),
    });
  }
  return options;
};

// The crafted look wins unless the user picked the portrait (and the person
// has one); a person without a look wears the portrait, else the stock image.
export const companionFace = (input: FaceInput): CompanionFace => {
  const { thread, companion } = input;
  const personId = thread?.id ?? input.id;
  const stock = faceSourceForId(personId, thread?.kind ?? input.kind);
  const portrait = portraitPresetForId(personId);
  const choice = input.choice ?? thread?.avatar;
  if (companion && !(choice === "portrait" && portrait)) {
    return lookFace(lookFromCompanion(companion), stock);
  }
  return portraitFace(portrait ?? stock);
};
