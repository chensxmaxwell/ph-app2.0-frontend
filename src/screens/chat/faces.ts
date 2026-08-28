import { ImageSourcePropType } from "react-native";
import { ChatKind } from "./types";

const KEVIN_FACE = require("../../../assets/images/message/kevin.png");
const CHAD_FACE = require("../../../assets/images/message/kevin-photo.png");
const AMANDA_FACE = require("../../../assets/images/girl.png");

export const faceSourceForId = (
  id?: string,
  kind?: ChatKind
): ImageSourcePropType => {
  switch (id) {
    case "kevin":
      return KEVIN_FACE;
    case "chad":
      return CHAD_FACE;
    case "amanda":
      return AMANDA_FACE;
    default: {
      if (kind === "human") {
        return CHAD_FACE;
      }
      return KEVIN_FACE;
    }
  }
};
