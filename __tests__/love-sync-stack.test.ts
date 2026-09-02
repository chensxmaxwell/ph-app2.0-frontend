import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "@jest/globals";
import { SCREENS } from "../src/common/constant";
import {
  stackForLoveLayer,
  stackForRestoredLoveLayer,
} from "../src/screens/love/stack";

const navBar = { name: String(SCREENS.NAV_BAR) };
const kevinThread = {
  name: String(SCREENS.CHAT_THREAD),
  params: { threadId: "kevin" },
};
const chadThread = {
  name: String(SCREENS.CHAT_THREAD),
  params: { threadId: "chad" },
};
const loveChat = {
  name: String(SCREENS.LOVE_CHAT),
  params: { companionId: "kevin", name: "Kevin" },
};
const loveSync = {
  name: String(SCREENS.LOVE_SYNC),
  params: { companionId: "kevin", name: "Kevin" },
};
const kevin = { companionId: "kevin", name: "Kevin" };

const names = (routes: { name: string }[]) => routes.map((route) => route.name);

describe("stackForLoveLayer", () => {
  it("opens Sync from a Message thread without stacking Love chat", () => {
    const routes = stackForLoveLayer({
      routes: [navBar, kevinThread],
      layer: "sync",
      params: kevin,
      surface: "message",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
      String(SCREENS.LOVE_SYNC),
    ]);
    expect(routes).not.toContainEqual(
      expect.objectContaining({ name: String(SCREENS.LOVE_CHAT) })
    );
  });

  it("returns to the Message thread, not a second Kevin chat, after Sync", () => {
    const afterSync = stackForLoveLayer({
      routes: [navBar, kevinThread, loveChat, loveSync],
      layer: "sync",
      params: kevin,
      surface: "message",
    });
    expect(names(afterSync)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
      String(SCREENS.LOVE_SYNC),
    ]);
    expect(names(afterSync.slice(0, -1))).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
    ]);
  });

  it("opens Sync from Love without leaving a Message clone underneath", () => {
    const routes = stackForLoveLayer({
      routes: [navBar, kevinThread, loveChat],
      layer: "sync",
      params: kevin,
      surface: "love",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.LOVE_CHAT),
      String(SCREENS.LOVE_SYNC),
    ]);
  });

  it("keeps Love chat as the only Kevin surface when Sync starts from Love", () => {
    const routes = stackForLoveLayer({
      routes: [navBar, loveChat],
      layer: "sync",
      params: kevin,
      surface: "love",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.LOVE_CHAT),
      String(SCREENS.LOVE_SYNC),
    ]);
  });

  it("returns to Home when Sync is opened from the root with no chat", () => {
    const routes = stackForLoveLayer({
      routes: [navBar],
      layer: "sync",
      params: kevin,
      surface: "message",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.LOVE_SYNC),
    ]);
  });

  it("restores a Love Sync session without bringing a Message thread along", () => {
    const routes = stackForLoveLayer({
      routes: [navBar, kevinThread],
      layer: "sync",
      params: kevin,
      surface: "love",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.LOVE_CHAT),
      String(SCREENS.LOVE_SYNC),
    ]);
  });

  it("does not drop a different person's Message thread", () => {
    const routes = stackForLoveLayer({
      routes: [navBar, chadThread, loveChat],
      layer: "sync",
      params: kevin,
      surface: "love",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
      String(SCREENS.LOVE_CHAT),
      String(SCREENS.LOVE_SYNC),
    ]);
    expect(routes[1]).toEqual(chadThread);
  });
});

describe("stackForRestoredLoveLayer", () => {
  it("restores Message Sync above the same thread so hang-up returns there", () => {
    const routes = stackForRestoredLoveLayer({
      routes: [navBar, kevinThread],
      layer: "sync",
      params: kevin,
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
      String(SCREENS.LOVE_SYNC),
    ]);
    expect(names(routes.slice(0, -1))).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
    ]);
    expect(routes).not.toContainEqual(
      expect.objectContaining({ name: String(SCREENS.LOVE_CHAT) })
    );
  });

  it("restores Love Sync onto Love chat when no matching thread remains", () => {
    const routes = stackForRestoredLoveLayer({
      routes: [navBar],
      layer: "sync",
      params: kevin,
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.LOVE_CHAT),
      String(SCREENS.LOVE_SYNC),
    ]);
  });
});

describe("Sync entry wiring", () => {
  it("opens Message Sync with fromMessage so Love chat is not pushed", () => {
    const threadSource = readFileSync(
      join(__dirname, "../src/screens/chat/thread.tsx"),
      "utf8"
    );
    expect(threadSource).toContain("fromMessage: true");
    expect(threadSource).toContain("syncing: true");
  });

  it("opens Love Sync onto the Love surface, not a Message thread", () => {
    const loveChatSource = readFileSync(
      join(__dirname, "../src/screens/love/chat.tsx"),
      "utf8"
    );
    expect(loveChatSource).toContain('surface: "love"');
    expect(loveChatSource).toContain("applyLoveLayer");
    expect(loveChatSource).not.toContain("SCREENS.LOVE_SYNC as never");
  });

  it("restores on the current chat surface and clears Message sync on hang-up", () => {
    const overlaySource = readFileSync(
      join(__dirname, "../src/screens/love/overlay.ts"),
      "utf8"
    );
    const syncSource = readFileSync(
      join(__dirname, "../src/screens/love/sync.tsx"),
      "utf8"
    );
    expect(overlaySource).toContain("stackForRestoredLoveLayer");
    expect(syncSource).toContain("setSynced(partnerId, false)");
  });
});
