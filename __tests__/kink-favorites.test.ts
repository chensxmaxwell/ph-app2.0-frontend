import { readFileSync } from "fs";
import { join } from "path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { Text, View } from "react-native";
import renderer, { act } from "react-test-renderer";

import {
  STORE_KEYS,
  scopedKey,
  writeSessionUser,
} from "../src/backend/session";
import {
  loadKinkFavorites,
  parseKinkFavorites,
  saveKinkFavorites,
  toggleKinkFavorite,
} from "../src/backend/store";
import {
  DEFAULT_KINK_FAVORITES,
  peekKinkFavorites,
  resetKinkFavoritesCache,
  useKinkFavorites,
} from "../src/screens/control/sub-screens/kink/favorites";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const CARDS = ["Hardcore", "Gentle", "Lazy", "kink-1700000000000"];

const bypass = { id: "bypass", email: "bypass@local", token: "bypass" };
const demo = { id: "demo", email: "demo@local", token: "local.demo" };

const favoritesKey = (userId: string) =>
  scopedKey(STORE_KEYS.kinkFavorites, userId);

const storedFavorites = async (userId: string) => {
  const raw = await AsyncStorage.getItem(favoritesKey(userId));
  return raw === null ? null : (JSON.parse(raw) as string[]);
};

// Stand-in for the Kink hub: one heart per card, driven by the same hook the
// real hub uses. The real hub file imports SVG icons, which this Jest config
// cannot load, so the wiring there is covered by a source check below.
const Hub = () => {
  const { isFavorite, toggleFavorite, hydrated } = useKinkFavorites();
  return React.createElement(
    View,
    { testID: hydrated ? "hub-ready" : "hub-loading" },
    CARDS.map((id) =>
      React.createElement(
        Text,
        { key: id, testID: `heart-${id}`, onPress: () => toggleFavorite(id) },
        isFavorite(id) ? "on" : "off"
      )
    )
  );
};

const trees: renderer.ReactTestRenderer[] = [];

const mountHub = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(React.createElement(Hub));
  });
  trees.push(tree);
  return tree;
};

const unmountHub = async (tree: renderer.ReactTestRenderer) => {
  await act(async () => {
    tree.unmount();
  });
  const index = trees.indexOf(tree);
  if (index !== -1) {
    trees.splice(index, 1);
  }
};

const heartNode = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(
    (node) => node.type === Text && node.props.testID === `heart-${id}`
  )[0];

const heart = (tree: renderer.ReactTestRenderer, id: string) =>
  heartNode(tree, id).props.children as string;

const hearts = (tree: renderer.ReactTestRenderer) =>
  Object.fromEntries(CARDS.map((id) => [id, heart(tree, id)]));

const tapHeart = async (tree: renderer.ReactTestRenderer, id: string) => {
  await act(async () => {
    heartNode(tree, id).props.onPress();
  });
};

const isReady = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAll(
    (node) => node.type === View && node.props.testID === "hub-ready"
  ).length === 1;

describe("kink favorites storage helpers", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("toggles an id in and out of the list without touching the others", () => {
    expect(toggleKinkFavorite(["Hardcore"], "Gentle")).toEqual([
      "Hardcore",
      "Gentle",
    ]);
    expect(toggleKinkFavorite(["Hardcore", "Gentle"], "Hardcore")).toEqual([
      "Gentle",
    ]);
    expect(toggleKinkFavorite([], "Lazy")).toEqual(["Lazy"]);
  });

  it("rejects garbage and keeps only unique non-empty ids", () => {
    expect(parseKinkFavorites(null)).toBeNull();
    expect(parseKinkFavorites("Hardcore")).toBeNull();
    expect(parseKinkFavorites({ Hardcore: true })).toBeNull();
    expect(parseKinkFavorites([])).toEqual([]);
    expect(
      parseKinkFavorites(["Hardcore", 3, "", null, "Gentle", "Hardcore"])
    ).toEqual(["Hardcore", "Gentle"]);
  });

  it("reads back what it wrote under a per-account ph.* key", async () => {
    expect(await loadKinkFavorites("bypass", ["Hardcore"])).toEqual([
      "Hardcore",
    ]);
    await saveKinkFavorites("bypass", ["Gentle", "kink-1700000000000"]);
    expect(await loadKinkFavorites("bypass", ["Hardcore"])).toEqual([
      "Gentle",
      "kink-1700000000000",
    ]);
    expect(await AsyncStorage.getItem("ph.kinkFavorites.v1:bypass")).toBe(
      JSON.stringify(["Gentle", "kink-1700000000000"])
    );
    expect(await loadKinkFavorites("demo", ["Hardcore"])).toEqual(["Hardcore"]);
  });

  it("falls back to the defaults when the stored blob is unreadable", async () => {
    await AsyncStorage.setItem(favoritesKey("bypass"), "{not json");
    expect(await loadKinkFavorites("bypass", ["Hardcore"])).toEqual([
      "Hardcore",
    ]);
    await AsyncStorage.setItem(
      favoritesKey("bypass"),
      JSON.stringify({ Hardcore: true })
    );
    expect(await loadKinkFavorites("bypass", ["Hardcore"])).toEqual([
      "Hardcore",
    ]);
  });
});

describe("Kink hub hearts persist across leave-and-return", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetKinkFavoritesCache();
    await writeSessionUser(bypass);
  });

  afterEach(async () => {
    for (const tree of [...trees]) {
      await unmountHub(tree);
    }
    await writeSessionUser(null);
    resetKinkFavoritesCache();
  });

  it("starts with Hardcore on and nothing written until the user taps", async () => {
    const tree = await mountHub();
    expect(isReady(tree)).toBe(true);
    expect(hearts(tree)).toEqual({
      Hardcore: "on",
      Gentle: "off",
      Lazy: "off",
      "kink-1700000000000": "off",
    });
    expect(DEFAULT_KINK_FAVORITES).toEqual(["Hardcore"]);
    expect(await storedFavorites("bypass")).toBeNull();
  });

  it("writes the heart to storage on tap and reads it back on remount", async () => {
    const first = await mountHub();
    await tapHeart(first, "Gentle");
    expect(heart(first, "Gentle")).toBe("on");
    expect(await storedFavorites("bypass")).toEqual(["Hardcore", "Gentle"]);

    // Leave Kink: the native stack unmounts the hub.
    await unmountHub(first);

    // Come back: the hub mounts again and must show the saved heart.
    const second = await mountHub();
    expect(heart(second, "Gentle")).toBe("on");
    expect(heart(second, "Hardcore")).toBe("on");
    expect(heart(second, "Lazy")).toBe("off");
  });

  it("survives killing the app: a fresh module cache rehydrates from storage", async () => {
    const before = await mountHub();
    await tapHeart(before, "Lazy");
    await tapHeart(before, "kink-1700000000000");
    await unmountHub(before);

    // Process death drops every in-memory copy but keeps AsyncStorage and the
    // signed-in bypass account.
    resetKinkFavoritesCache();
    expect(peekKinkFavorites().hydrated).toBe(false);

    const after = await mountHub();
    expect(isReady(after)).toBe(true);
    expect(hearts(after)).toEqual({
      Hardcore: "on",
      Gentle: "off",
      Lazy: "on",
      "kink-1700000000000": "on",
    });
  });

  it("remembers that the default Hardcore heart was turned off", async () => {
    const first = await mountHub();
    await tapHeart(first, "Hardcore");
    expect(heart(first, "Hardcore")).toBe("off");
    expect(await storedFavorites("bypass")).toEqual([]);

    await unmountHub(first);
    resetKinkFavoritesCache();

    const second = await mountHub();
    expect(heart(second, "Hardcore")).toBe("off");
  });

  it("applies a heart tapped before hydration finished on top of the stored list", async () => {
    await saveKinkFavorites("bypass", ["Hardcore", "Gentle"]);
    resetKinkFavoritesCache();

    // A synchronous act mounts the hub and starts the AsyncStorage read, but
    // the read has not resolved yet when we tap.
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(React.createElement(Hub));
    });
    trees.push(tree);
    expect(isReady(tree)).toBe(false);
    expect(heart(tree, "Gentle")).toBe("off");

    await tapHeart(tree, "Lazy");

    expect(isReady(tree)).toBe(true);
    expect(hearts(tree)).toEqual({
      Hardcore: "on",
      Gentle: "on",
      Lazy: "on",
      "kink-1700000000000": "off",
    });
    expect(await storedFavorites("bypass")).toEqual([
      "Hardcore",
      "Gentle",
      "Lazy",
    ]);
  });

  it("keeps hearts scoped to the signed-in account", async () => {
    const tree = await mountHub();
    await tapHeart(tree, "Gentle");

    await act(async () => {
      await writeSessionUser(demo);
    });
    expect(isReady(tree)).toBe(true);
    expect(hearts(tree)).toEqual({
      Hardcore: "on",
      Gentle: "off",
      Lazy: "off",
      "kink-1700000000000": "off",
    });
    await tapHeart(tree, "Lazy");
    expect(await storedFavorites("demo")).toEqual(["Hardcore", "Lazy"]);
    expect(await storedFavorites("bypass")).toEqual(["Hardcore", "Gentle"]);

    await act(async () => {
      await writeSessionUser(bypass);
    });
    expect(hearts(tree)).toEqual({
      Hardcore: "on",
      Gentle: "on",
      Lazy: "off",
      "kink-1700000000000": "off",
    });
  });

  it("keeps hearts tappable but unsaved when nobody is signed in", async () => {
    await writeSessionUser(null);
    const tree = await mountHub();
    expect(isReady(tree)).toBe(true);
    await tapHeart(tree, "Gentle");
    expect(heart(tree, "Gentle")).toBe("on");
    expect(await AsyncStorage.getAllKeys()).toEqual([]);

    await act(async () => {
      await writeSessionUser(bypass);
    });
    expect(hearts(tree)).toEqual({
      Hardcore: "on",
      Gentle: "off",
      Lazy: "off",
      "kink-1700000000000": "off",
    });
  });

  it("keeps two mounted hubs in sync", async () => {
    const control = await mountHub();
    const fromLove = await mountHub();
    await tapHeart(fromLove, "Gentle");
    expect(heart(control, "Gentle")).toBe("on");
    await tapHeart(control, "Gentle");
    expect(heart(fromLove, "Gentle")).toBe("off");
    expect(await storedFavorites("bypass")).toEqual(["Hardcore"]);
  });
});

describe("Kink hub wiring", () => {
  const hooksSource = readFileSync(
    join(__dirname, "../src/screens/control/sub-screens/kink/hooks.tsx"),
    "utf8"
  );

  it("drives the card hearts from the persisted favorites hook", () => {
    expect(hooksSource).toContain("useKinkFavorites()");
    expect(hooksSource).toContain("favorite: isFavorite(id)");
    expect(hooksSource).toContain("onFavoritePress: () => toggleFavorite(id)");
    expect(hooksSource).not.toContain("useState<Record<string, boolean>>");
  });
});
