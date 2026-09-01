import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it, beforeEach } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORE_KEYS, scopedKey, writeSessionUser } from "../src/backend/session";
import { LoveSessionProvider, useLoveSession } from "../src/screens/love/session";
import {
  emptyLoveSession,
  liveFromPersisted,
  parsePersistedLoveSession,
  showsSessionLovePill,
  snapshotLoveSession,
} from "../src/screens/love/session-logic";
import {
  clearLoveSessionBoot,
  initialLoveSessionFromBoot,
  loadLoveSessionForUser,
  prepareLoveSessionBoot,
  saveLoveSessionForUser,
} from "../src/screens/love/session-persist";
import type { LiveLoveSession } from "../src/screens/love/session-logic";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const kevinSession = (
  patch: Partial<LiveLoveSession> = {}
): LiveLoveSession => ({
  companionId: "kevin",
  layer: "chat",
  minimized: true,
  chat: {
    companionId: "kevin",
    name: "Kevin",
    personality: "Playful",
    story: "A companion.",
    messages: [
      {
        kind: "bubble",
        id: "k1",
        from: "them",
        text: "Hey, it's Kevin. I'm here.",
      },
    ],
    synced: false,
    inCall: false,
    listen: false,
    pinned: true,
    mode: "none",
  },
  callStartedAt: null,
  syncStartedAt: 1700000000000,
  ...patch,
});

describe("Love session persist and restore", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await writeSessionUser(null);
    clearLoveSessionBoot();
  });

  it("does not persist an ended or empty session", () => {
    expect(snapshotLoveSession(emptyLoveSession())).toBeNull();
    expect(showsSessionLovePill(emptyLoveSession())).toBe(false);
    expect(showsSessionLovePill(liveFromPersisted(null))).toBe(false);
  });

  it("keeps companion, timers, and chat when snapshotting an active session", () => {
    const live = kevinSession({
      minimized: false,
      callStartedAt: 42,
      layer: "call",
    });
    expect(snapshotLoveSession(live)).toEqual(live);
  });

  it("rehydrates an active session as a global pill after process death", () => {
    const overlay = kevinSession({ minimized: false, layer: "sync" });
    const restored = liveFromPersisted(overlay);
    expect(restored.companionId).toBe("kevin");
    expect(restored.layer).toBe("sync");
    expect(restored.chat?.name).toBe("Kevin");
    expect(restored.syncStartedAt).toBe(1700000000000);
    expect(restored.minimized).toBe(true);
    expect(showsSessionLovePill(restored)).toBe(true);
  });

  it("rejects garbage and sessions without a Love layer", () => {
    expect(parsePersistedLoveSession(null)).toBeNull();
    expect(parsePersistedLoveSession("kevin")).toBeNull();
    expect(parsePersistedLoveSession({ companionId: "kevin" })).toBeNull();
    expect(parsePersistedLoveSession({ layer: "video" })).toBeNull();
  });

  it("parses a valid persisted session and drops broken chat items", () => {
    const parsed = parsePersistedLoveSession({
      companionId: "kevin",
      layer: "chat",
      minimized: true,
      callStartedAt: 10,
      syncStartedAt: "nope",
      chat: {
        companionId: "kevin",
        name: "Kevin",
        messages: [
          { kind: "bubble", id: "ok", from: "me", text: "hi" },
          { kind: "nope", id: "bad" },
          { kind: "sync", id: "s1" },
        ],
      },
    });
    expect(parsed).toMatchObject({
      companionId: "kevin",
      layer: "chat",
      minimized: true,
      callStartedAt: 10,
      syncStartedAt: null,
    });
    expect(parsed?.chat?.messages).toEqual([
      { kind: "bubble", id: "ok", from: "me", text: "hi" },
      { kind: "sync", id: "s1" },
    ]);
  });

  it("survives kill and relaunch for the same on-device account", async () => {
    await saveLoveSessionForUser("demo", kevinSession());
    clearLoveSessionBoot();
    await writeSessionUser({
      id: "demo",
      email: "demo@local",
      token: "local.demo",
    });

    const boot = await prepareLoveSessionBoot("demo");
    expect(boot.userId).toBe("demo");
    expect(showsSessionLovePill(boot.live)).toBe(true);
    expect(boot.live.companionId).toBe("kevin");
    expect(initialLoveSessionFromBoot()).toMatchObject({
      userId: "demo",
      ready: true,
      live: expect.objectContaining({ companionId: "kevin", minimized: true }),
    });

    const scoped = await AsyncStorage.getItem(
      scopedKey(STORE_KEYS.loveSession, "demo")
    );
    expect(scoped).toContain("kevin");
  });

  it("does not restore a pill after the session is ended", async () => {
    await saveLoveSessionForUser("demo", kevinSession());
    await saveLoveSessionForUser("demo", emptyLoveSession());

    const parsed = await loadLoveSessionForUser("demo");
    expect(parsed).toBeNull();

    const boot = await prepareLoveSessionBoot("demo");
    expect(showsSessionLovePill(boot.live)).toBe(false);
    expect(boot.live.layer).toBeNull();
  });

  it("keeps Love sessions isolated across accounts", async () => {
    await saveLoveSessionForUser("demo", kevinSession());
    await saveLoveSessionForUser(
      "bypass",
      kevinSession({
        companionId: "chad",
        chat: {
          companionId: "chad",
          name: "Chad",
          messages: [],
          synced: false,
          inCall: false,
          listen: false,
          pinned: true,
          mode: "none",
        },
      })
    );

    const demoBoot = await prepareLoveSessionBoot("demo");
    expect(demoBoot.live.companionId).toBe("kevin");

    await writeSessionUser({
      id: "bypass",
      email: "bypass@local",
      token: "bypass",
    });
    const bypassBoot = await prepareLoveSessionBoot("bypass");
    expect(bypassBoot.live.companionId).toBe("chad");
    expect(showsSessionLovePill(bypassBoot.live)).toBe(true);

    const demoKey = await AsyncStorage.getItem(
      scopedKey(STORE_KEYS.loveSession, "demo")
    );
    const bypassKey = await AsyncStorage.getItem(
      scopedKey(STORE_KEYS.loveSession, "bypass")
    );
    expect(demoKey).toContain("kevin");
    expect(bypassKey).toContain("chad");
    expect(demoKey).not.toContain("chad");
    expect(bypassKey).not.toContain("kevin");

    await writeSessionUser({
      id: "other",
      email: "other@local",
      token: "other",
    });
    const otherBoot = await prepareLoveSessionBoot("other");
    expect(showsSessionLovePill(otherBoot.live)).toBe(false);
    expect(initialLoveSessionFromBoot().live.companionId).toBeUndefined();
  });

  const Probe = () => {
    const { minimized, companionId, layer, end } = useLoveSession();
    const label = minimized && layer ? companionId ?? "unknown" : "none";
    return React.createElement(Text, { onPress: end }, label);
  };

  it("hydrates LoveSessionProvider from boot before the first paint", async () => {
    await saveLoveSessionForUser("demo", kevinSession());
    await writeSessionUser({
      id: "demo",
      email: "demo@local",
      token: "local.demo",
    });
    await prepareLoveSessionBoot("demo");

    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(
        React.createElement(LoveSessionProvider, null, React.createElement(Probe))
      );
    });

    expect(tree?.root.findByType(Text).props.children).toBe("kevin");

    await act(async () => {
      tree?.root.findByType(Text).props.onPress();
    });
    expect(tree?.root.findByType(Text).props.children).toBe("none");
    expect(await loadLoveSessionForUser("demo")).toBeNull();
  });
});

