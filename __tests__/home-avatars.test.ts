import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "@jest/globals";
import { ROW_AVATAR_SIZE, circleAvatarStyle } from "../src/screens/avatar/circle-avatar";
import { faceSourceForId } from "../src/screens/chat/faces";
import { MOCK_HOME_COMPANIONS } from "../src/screens/home/mock-companions";

const homeSource = readFileSync(
  join(__dirname, "../src/screens/home/index.tsx"),
  "utf8"
);

describe("circleAvatarStyle", () => {
  it("keeps a perfect non-shrinking circle for the companions row", () => {
    expect(circleAvatarStyle(ROW_AVATAR_SIZE)).toMatchObject({
      width: 70,
      height: 70,
      borderRadius: 35,
      overflow: "hidden",
      flexShrink: 0,
      aspectRatio: 1,
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

describe("home header", () => {
  it("uses the original house graphic as the hero, not a companion portrait", () => {
    expect(homeSource).toContain('@images/3d-rendering-cartoon-house.svg');
    expect(homeSource).toMatch(/<View style=\{styles\.hero\}>\s*<House \/>\s*<\/View>/);
    expect(homeSource).not.toContain("heroFace");
    expect(homeSource).not.toContain("HERO_AVATAR_SIZE");
    expect(homeSource).not.toContain("AvatarPreview");
    expect(homeSource).not.toMatch(/styles\.hero[\s\S]*HomeFace/);
  });

  it("does not show Anonymous User or any display name under Pleasure House", () => {
    expect(homeSource).toContain("Pleasure House");
    expect(homeSource).not.toContain("displayName");
    expect(homeSource).not.toContain("useProfile");
    expect(homeSource).not.toContain("Anonymous User");
    expect(homeSource).not.toContain("userName");
    expect(homeSource).not.toContain("resolveProfileDisplayName");
  });
});
