import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "@jest/globals";
import { ROW_AVATAR_SIZE, circleAvatarStyle } from "../src/screens/avatar/circle-avatar";
import { seedThreads } from "../src/backend/chat-seed";
import { faceSourceForId } from "../src/screens/chat/faces";

const homeSource = readFileSync(
  join(__dirname, "../src/screens/home/index.tsx"),
  "utf8"
);
const homeHooksSource = readFileSync(
  join(__dirname, "../src/screens/home/hooks.ts"),
  "utf8"
);
const homeStackSource = readFileSync(
  join(__dirname, "../navigations/home-stack.tsx"),
  "utf8"
);
const screenConstantsSource = readFileSync(
  join(__dirname, "../src/common/constant/index.ts"),
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

describe("home seeded portraits", () => {
  it("maps seeded Kevin, Chad, and Amanda to distinct circular photo sources", () => {
    const sources = seedThreads().map((thread) =>
      faceSourceForId(thread.id, thread.kind)
    );
    expect(sources).toHaveLength(3);
    expect(new Set(sources).size).toBe(3);
  });

  it("reads My Companions from the Message friends list, not a Home-only catalog", () => {
    // TestFlight 1.2 (11): Kevin deleted from Message still sat on Home
    // because Home rendered a static mock list that knew nothing about the
    // chat store's tombstones.
    expect(
      existsSync(join(__dirname, "../src/screens/home/mock-companions.ts"))
    ).toBe(false);
    expect(homeSource).not.toContain("MOCK_HOME_COMPANIONS");
    expect(homeHooksSource).not.toContain("MOCK_HOME_COMPANIONS");
    expect(homeHooksSource).not.toMatch(/const companions\b/);
    expect(homeSource).not.toContain("useCompanions()");
    expect(homeSource).toContain("useHomeCompanions");
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

  it("keeps the My Companions circular row and companion tap to a Message thread", () => {
    expect(homeSource).toContain("My Companions");
    expect(homeSource).toContain("circleAvatarStyle(ROW_AVATAR_SIZE)");
    expect(homeSource).toContain("SCREENS.CHAT_THREAD");
    expect(homeSource).toMatch(/openCompanion\(companion\.id\)/);
  });
});

describe("home recent feed", () => {
  it("does not seed a fake other-people comment wall", () => {
    expect(existsSync(join(__dirname, "../src/screens/home/feed.tsx"))).toBe(
      false
    );
    expect(homeHooksSource).not.toContain("See what others are saying.");
    expect(homeHooksSource).not.toMatch(/type:\s*"Feed"/);
    expect(homeHooksSource).not.toContain("SCREENS.FEED");
    expect(homeSource).not.toContain("SCREENS.FEED");
    expect(homeSource).not.toContain("This one hit different.");
    expect(homeSource).not.toContain("Saving this for later tonight.");
    expect(homeSource).not.toContain("Hardcore is the move.");
    expect(homeStackSource).not.toContain("FeedScreen");
    expect(homeStackSource).not.toContain("SCREENS.FEED");
    expect(screenConstantsSource).not.toMatch(/FEED:\s*"Feed"/);
  });

  it("keeps the real Recent shortcuts and does not leave an empty Recent block", () => {
    expect(homeSource).toContain("Recent");
    expect(homeHooksSource).toContain('type: "Alarm"');
    expect(homeHooksSource).toContain('title: "Hardcore"');
    expect(homeHooksSource).toContain("SCREENS.PERFORMANCE_PLAY");
  });
});
