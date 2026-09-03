import type { ImageSourcePropType } from "react-native";
import type { AvatarLook } from "./engine/viewer-html";
import { Companion, lookFromCompanion } from "../../store/companions";
import { faceSourceForId, portraitPresetForId } from "../chat/faces";
import type { AvatarChoice, ChatKind, ChatThread } from "../chat/types";
import { Portrait, portraitById, portraitsForGender } from "./portraits";

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

export const LOOK_OPTION_LABEL = "3D avatar";
export const PHOTO_OPTION_LABEL = "Photo";

export const avatarOptionLabel = (kind: AvatarChoice): string => {
  switch (kind) {
    case "look":
      return LOOK_OPTION_LABEL;
    case "portrait":
      return PHOTO_OPTION_LABEL;
    default:
      return portraitById(kind)?.label ?? kind;
  }
};

export type FaceInput = {
  // Person id when there is no thread yet (a companion record on its own, or
  // an id nothing is stored for).
  id?: string;
  kind?: ChatKind;
  thread?: ChatThread;
  companion?: Companion;
  // Overrides the thread's stored pick; used by the picker to preview and by
  // the wizard, whose draft holds the pick before anything is saved.
  choice?: AvatarChoice;
  // Overrides the stored gender for the portrait filter (the wizard's draft).
  gender?: string;
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

const bundledFace = (portrait: Portrait): CompanionFace => ({
  kind: portrait.id,
  look: null,
  source: portrait.source,
});

const bundledOption = (portrait: Portrait): AvatarOption => ({
  kind: portrait.id,
  label: portrait.label,
  face: bundledFace(portrait),
});

// What this person could wear: the crafted look when a companion record
// exists, the bundled photo when the person is a seeded one, and the generated
// portraits for their gender (all six for Non-binary or unknown). The current
// pick is always offered, so changing gender never hides the selected face.
export const avatarOptions = ({
  id,
  kind,
  thread,
  companion,
  choice,
  gender,
}: FaceInput): AvatarOption[] => {
  const personId = thread?.id ?? id;
  const stock = faceSourceForId(personId, thread?.kind ?? kind);
  const options: AvatarOption[] = [];
  if (companion) {
    options.push({
      kind: "look",
      label: LOOK_OPTION_LABEL,
      face: lookFace(lookFromCompanion(companion), stock),
    });
  }
  const portrait = portraitPresetForId(personId);
  if (portrait) {
    options.push({
      kind: "portrait",
      label: PHOTO_OPTION_LABEL,
      face: portraitFace(portrait),
    });
  }
  const filtered = portraitsForGender(
    gender ?? companion?.gender ?? thread?.gender
  );
  filtered.forEach((item) => options.push(bundledOption(item)));
  const picked = portraitById(choice ?? thread?.avatar);
  if (picked && !filtered.includes(picked)) {
    options.push(bundledOption(picked));
  }
  return options;
};

// A bundled portrait pick wins outright; otherwise the crafted look wins
// unless the user picked the photo (and the person has one); a person without
// a look wears the portrait, else the stock image.
export const companionFace = (input: FaceInput): CompanionFace => {
  const { thread, companion } = input;
  const personId = thread?.id ?? input.id;
  const stock = faceSourceForId(personId, thread?.kind ?? input.kind);
  const portrait = portraitPresetForId(personId);
  const choice = input.choice ?? thread?.avatar;
  const bundled = portraitById(choice);
  if (bundled) {
    return bundledFace(bundled);
  }
  if (companion && !(choice === "portrait" && portrait)) {
    return lookFace(lookFromCompanion(companion), stock);
  }
  return portraitFace(portrait ?? stock);
};
