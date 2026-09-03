import { ImageSourcePropType } from "react-native";
import { ChatKind } from "./types";

const KEVIN_FACE = require("../../../assets/images/message/kevin.png");
const CHAD_FACE = require("../../../assets/images/message/kevin-photo.png");
const AMANDA_FACE = require("../../../assets/images/girl.png");

// The bundled photo a seeded person owns, and nobody else: a crafted companion
// must never be offered Kevin's photo as if it were their own preset.
export const portraitPresetForId = (
  id?: string
): ImageSourcePropType | null => {
  switch (id) {
    case "kevin":
      return KEVIN_FACE;
    case "chad":
      return CHAD_FACE;
    case "amanda":
      return AMANDA_FACE;
    default:
      return null;
  }
};

// Last-resort stock portrait for an id. Screens that show a person should go
// through `companionFace` (src/screens/avatar/face.ts) so a crafted look and
// the user's avatar pick win over this.
export const faceSourceForId = (
  id?: string,
  kind?: ChatKind
): ImageSourcePropType => {
  const preset = portraitPresetForId(id);
  if (preset) {
    return preset;
  }
  if (kind === "human") {
    return CHAD_FACE;
  }
  return KEVIN_FACE;
};
