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
const kevinSettings = {
  name: String(SCREENS.CHAT_SETTINGS),
  params: { threadId: "kevin" },
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
const controlSyncStack = {
  name: String(SCREENS.SYNC_STACK),
  params: undefined,
};

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
      surface: "message",
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

  it("keeps an explicitly Love-origin restore on Love chat", () => {
    const routes = stackForRestoredLoveLayer({
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

  it("drops routes above the original Message thread before restoring Sync", () => {
    const routes = stackForRestoredLoveLayer({
      routes: [navBar, kevinThread, kevinSettings],
      layer: "sync",
      params: kevin,
      surface: "message",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
      String(SCREENS.LOVE_SYNC),
    ]);
  });

  it("recreates the original Message thread when its route is gone", () => {
    const routes = stackForRestoredLoveLayer({
      routes: [navBar],
      layer: "sync",
      params: kevin,
      surface: "message",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
      String(SCREENS.LOVE_SYNC),
    ]);
    expect(routes[1]).toEqual(kevinThread);
  });
});

// Control hub (Maxwell: "Playground") → Sync card → pick a person → SyncScreen.
// Minimize pops the whole SyncStack, so the pill sits on the Control hub with
// nothing Love-related underneath. Restore must put LoveSync straight on top of
// that hub; a LoveChat here is the dark chat that flashes and that red X lands on.
describe("Control hub Sync origin", () => {
  it("restores a Control Sync directly over the hub, never through a dark Love chat", () => {
    const routes = stackForRestoredLoveLayer({
      routes: [navBar],
      layer: "sync",
      params: kevin,
      surface: "control",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.LOVE_SYNC),
    ]);
    expect(routes).not.toContainEqual(
      expect.objectContaining({ name: String(SCREENS.LOVE_CHAT) })
    );
    expect(routes).not.toContainEqual(
      expect.objectContaining({ name: String(SCREENS.CHAT_THREAD) })
    );
  });

  it("keeps the Control hub route itself under Sync so hang-up uncovers the same tab", () => {
    const routes = stackForRestoredLoveLayer({
      routes: [navBar],
      layer: "sync",
      params: kevin,
      surface: "control",
    });
    expect(routes.slice(0, -1)).toEqual([navBar]);
    expect(routes[0]).toBe(navBar);
  });

  it("opens the Control Sync overlay without a Love chat when the layer is applied", () => {
    const routes = stackForLoveLayer({
      routes: [navBar],
      layer: "sync",
      params: kevin,
      surface: "control",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.LOVE_SYNC),
    ]);
  });

  it("drops a stale Love chat left under a Control Sync instead of restoring onto it", () => {
    const routes = stackForRestoredLoveLayer({
      routes: [navBar, loveChat, loveSync],
      layer: "sync",
      params: kevin,
      surface: "control",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.LOVE_SYNC),
    ]);
  });

  it("leaves non-Love routes such as the Sync picker stack untouched", () => {
    const routes = stackForLoveLayer({
      routes: [navBar, controlSyncStack],
      layer: "sync",
      params: kevin,
      surface: "control",
    });
    expect(names(routes)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.SYNC_STACK),
      String(SCREENS.LOVE_SYNC),
    ]);
    expect(routes[1]).toBe(controlSyncStack);
  });

  it("never recreates a Message thread for a Control-origin Sync after relaunch", () => {
    const routes = stackForRestoredLoveLayer({
      routes: [navBar],
      layer: "sync",
      params: kevin,
      surface: "control",
    });
    expect(routes).not.toContainEqual(
      expect.objectContaining({ name: String(SCREENS.CHAT_THREAD) })
    );
    expect(routes.length).toBe(2);
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

  it("records the Control hub as the Sync origin instead of pretending it was Love chat", () => {
    const controlSyncSource = readFileSync(
      join(__dirname, "../src/screens/sync/sync_screen.tsx"),
      "utf8"
    );
    expect(controlSyncSource).toContain('surface: "control"');
    expect(controlSyncSource).not.toContain('surface: "love"');
  });

  it("ends a Control-origin Sync on red X instead of falling back to a Love chat", () => {
    const syncSource = readFileSync(
      join(__dirname, "../src/screens/love/sync.tsx"),
      "utf8"
    );
    expect(syncSource).toContain('case "control"');
    expect(syncSource).toContain("end();");
    expect(syncSource).toContain("dismissLoveOverlays(navigation)");
  });

  it("restores on the recorded chat surface and clears Message sync on hang-up", () => {
    const overlaySource = readFileSync(
      join(__dirname, "../src/screens/love/overlay.ts"),
      "utf8"
    );
    const pillSource = readFileSync(
      join(__dirname, "../src/screens/love/pill.tsx"),
      "utf8"
    );
    const syncSource = readFileSync(
      join(__dirname, "../src/screens/love/sync.tsx"),
      "utf8"
    );
    expect(overlaySource).toContain("stackForRestoredLoveLayer");
    expect(overlaySource).toContain("surface: LoveStackSurface");
    expect(pillSource).toContain(
      "layer,\n          surface,\n          companionId"
    );
    expect(syncSource).toContain("setSynced(partnerId, false)");
  });
});
