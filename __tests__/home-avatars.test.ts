import { describe, expect, it } from "@jest/globals";
import {
  HERO_AVATAR_SIZE,
  ROW_AVATAR_SIZE,
  circleAvatarStyle,
} from "../src/screens/avatar/circle-avatar";
import { faceSourceForId } from "../src/screens/chat/faces";
import { MOCK_HOME_COMPANIONS } from "../src/screens/home/mock-companions";

describe("circleAvatarStyle", () => {
  it("keeps a perfect non-shrinking circle", () => {
    expect(circleAvatarStyle(ROW_AVATAR_SIZE)).toMatchObject({
      width: 70,
      height: 70,
      borderRadius: 35,
      overflow: "hidden",
      flexShrink: 0,
      aspectRatio: 1,
    });
    expect(circleAvatarStyle(HERO_AVATAR_SIZE)).toMatchObject({
      width: 180,
      height: 180,
      borderRadius: 90,
      overflow: "hidden",
      flexShrink: 0,
    });
  });
});

describe("home mock portraits", () => {
  it("maps Kevin, Chad, and Amanda to distinct circular photo sources", () => {
    const sources = MOCK_HOME_COMPANIONS.map((person) =>
      faceSourceForId(person.id)
    );
    expect(sources).toHaveLength(3);
    expect(new Set(sources).size).toBe(3);
  });
});
