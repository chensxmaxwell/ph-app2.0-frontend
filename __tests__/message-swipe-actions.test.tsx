import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import renderer, {
  act,
  ReactTestInstance,
  ReactTestRenderer,
} from "react-test-renderer";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCREENS } from "../src/common/constant";
import { writeSessionUser } from "../src/backend/session";
import { loadChat } from "../src/backend/store";
import { seedDirectory, seedThreads } from "../src/backend/chat-seed";
import { CompanionsProvider } from "../src/store/companions";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import { Chat } from "../src/screens/chat";
import { ChatThreadScreen } from "../src/screens/chat/thread";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-linear-gradient", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View };
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => insets,
  };
});
jest.mock("../src/screens/love/pill", () => ({
  useOpenLove: () => jest.fn(),
}));

type NavigateCall = { name: string; params?: object };
type FakeNavigation = {
  goBack: () => void;
  navigate: (name: string, params?: object) => void;
  getParent: () => FakeNavigation | undefined;
  calls: NavigateCall[];
};

const fakeNavigation = (parent?: FakeNavigation): FakeNavigation => {
  const calls: NavigateCall[] = [];
  return {
    goBack: jest.fn(),
    navigate: jest.fn((name: string, params?: object) => {
      calls.push({ name, params });
    }),
    getParent: () => parent,
    calls,
  };
};

let homeStack: FakeNavigation = fakeNavigation();
let mockNavigation: FakeNavigation = fakeNavigation(homeStack);
let mockRoute: { name: string; params?: object } = {
  name: String(SCREENS.CHAT),
};
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useIsFocused: () => true,
}));

const SEED_IDS = seedThreads().map((thread) => thread.id);
const GRAY = "#8e8e93";
const RED = "#f95f6e";

type ChatApi = ReturnType<typeof useChat>;
let api: ChatApi | null = null;
const Probe = () => {
  api = useChat();
  return null;
};

const flush = async () => {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};
const settle = () => act(flush);
// The chat store debounces its AsyncStorage write by 250ms.
const persisted = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 320));
    await flush();
  });

const trees: ReactTestRenderer[] = [];

// Message rows and the thread header draw each person's one face, which
// pairs the thread with its 3D record, so the companions store sits above the
// chat store exactly as in App.tsx.
const Screens = ({ thread }: { thread?: string }) => (
  <CompanionsProvider>
    <ChatProvider>
      <Probe />
      <Chat />
      {thread ? <ChatThreadScreen /> : null}
    </ChatProvider>
  </CompanionsProvider>
);

const mountList = async () => {
  homeStack = fakeNavigation();
  mockNavigation = fakeNavigation(homeStack);
  mockRoute = { name: String(SCREENS.CHAT) };
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Screens />);
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

// Simulates what navigating to CHAT_THREAD does: mounts the thread screen for
// that id on top of the list, inside the same store.
const openThreadScreen = async (tree: ReactTestRenderer, threadId: string) => {
  mockRoute = { name: String(SCREENS.CHAT_THREAD), params: { threadId } };
  act(() => {
    tree.update(<Screens thread={threadId} />);
  });
  await settle();
};

const press = (node: ReactTestInstance) => {
  act(() => {
    node.props.onPress();
  });
};

const touchables = (root: ReactTestInstance) =>
  root.findAllByType(TouchableOpacity);

const findTouchable = (root: ReactTestInstance, testID: string) =>
  touchables(root).find((node) => node.props.testID === testID);

const touchable = (root: ReactTestInstance, testID: string) => {
  const match = findTouchable(root, testID);
  if (!match) {
    throw new Error(`No TouchableOpacity with testID ${testID}`);
  }
  return match;
};

const hasTestID = (root: ReactTestInstance, testID: string) =>
  root.findAll((node) => node.props.testID === testID).length > 0;

const texts = (root: ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map((node) => React.Children.toArray(node.props.children).join(""));

const label = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((text) => React.Children.toArray(text.props.children).join(""))
    .join("");

const background = (node: ReactTestInstance) =>
  StyleSheet.flatten(node.props.style).backgroundColor;

// The Swipeable that wraps a given Message row.
const swipeRow = (tree: ReactTestRenderer, threadId: string) => {
  const match = tree.root
    .findAllByType(Swipeable)
    .find((row) => findTouchable(row, `message-row-${threadId}`));
  if (!match) {
    throw new Error(`Row ${threadId} is not wrapped in a Swipeable`);
  }
  return match;
};

const rowIds = (tree: ReactTestRenderer) =>
  touchables(tree.root)
    .map((node) => String(node.props.testID ?? ""))
    .filter((id) => /^message-row-[^-]+$/.test(id))
    .map((id) => id.replace("message-row-", ""));

const swipeDelete = (tree: ReactTestRenderer, threadId: string) => {
  press(touchable(tree.root, `message-row-delete-${threadId}`));
};

const confirmDelete = (tree: ReactTestRenderer) => {
  press(touchable(tree.root, "message-delete-confirm-primary"));
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  api = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
});

describe("Message list: swipe a row left", () => {
  it("wraps every thread row in a left swipe that reveals gray Mark unread then red Delete friend, nothing else", async () => {
    const tree = await mountList();
    expect(rowIds(tree).sort()).toEqual([...SEED_IDS].sort());

    for (const id of SEED_IDS) {
      const row = swipeRow(tree, id);
      // Swipe left only: right-side actions, no left-side panel.
      expect(row.props.renderRightActions).toEqual(expect.any(Function));
      expect(row.props.renderLeftActions).toBeUndefined();

      const actions = touchables(row).filter(
        (node) => node.props.testID !== `message-row-${id}`
      );
      expect(actions.map((node) => node.props.testID)).toEqual([
        `message-row-unread-${id}`,
        `message-row-delete-${id}`,
      ]);
      expect(actions.map(label)).toEqual(["Mark unread", "Delete friend"]);
      expect(background(actions[0])).toBe(GRAY);
      expect(background(actions[1])).toBe(RED);

      // The actions live behind the row (revealed by the swipe), not inside
      // the tappable row itself.
      const rowButton = touchable(row, `message-row-${id}`);
      expect(touchables(rowButton)).toHaveLength(1);
    }
    // No WeChat extras such as 「不显示」 / Hide, and no standalone Mark read.
    expect(texts(tree.root)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/hide|不显示|mark read|标记已读/i),
      ])
    );
  });

  it("Mark unread flips the thread to unread and shows the badge; tapping it again keeps it unread", async () => {
    const tree = await mountList();
    expect(api!.getThread("chad")!.unread).toBeFalsy();
    expect(hasTestID(tree.root, "message-row-unread-dot-chad")).toBe(false);

    press(touchable(tree.root, "message-row-unread-chad"));

    expect(api!.getThread("chad")!.unread).toBe(true);
    expect(hasTestID(tree.root, "message-row-unread-dot-chad")).toBe(true);
    // Only Chad is unread.
    expect(hasTestID(tree.root, "message-row-unread-dot-kevin")).toBe(false);
    expect(hasTestID(tree.root, "message-row-unread-dot-amanda")).toBe(false);

    press(touchable(tree.root, "message-row-unread-chad"));
    expect(api!.getThread("chad")!.unread).toBe(true);
    expect(label(touchable(tree.root, "message-row-unread-chad"))).toBe(
      "Mark unread"
    );
  });

  it("unread survives a relaunch and is cleared by opening the thread", async () => {
    let tree = await mountList();
    press(touchable(tree.root, "message-row-unread-chad"));
    await persisted();
    expect(
      (await loadChat("demo")).threads.find((thread) => thread.id === "chad")
        ?.unread
    ).toBe(true);

    act(() => {
      trees.splice(0).forEach((item) => item.unmount());
    });
    tree = await mountList();
    expect(api!.getThread("chad")!.unread).toBe(true);
    expect(hasTestID(tree.root, "message-row-unread-dot-chad")).toBe(true);

    // Tapping the row opens the thread…
    press(touchable(tree.root, "message-row-chad"));
    expect(homeStack.calls).toEqual([
      { name: String(SCREENS.CHAT_THREAD), params: { threadId: "chad" } },
    ]);
    // …and the thread screen reads it.
    await openThreadScreen(tree, "chad");
    expect(api!.getThread("chad")!.unread).toBe(false);
    expect(hasTestID(tree.root, "message-row-unread-dot-chad")).toBe(false);
  });

  it("Delete friend double-checks first: the tap alone deletes nothing and Cancel keeps the row", async () => {
    const tree = await mountList();

    swipeDelete(tree, "chad");

    expect(api!.getThread("chad")).toBeDefined();
    expect(rowIds(tree)).toContain("chad");
    expect(hasTestID(tree.root, "message-delete-confirm")).toBe(true);
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining(["Delete Chad?", "Cancel"])
    );
    expect(label(touchable(tree.root, "message-delete-confirm-primary"))).toBe(
      "Delete friend"
    );

    press(touchable(tree.root, "message-delete-confirm-secondary"));

    expect(hasTestID(tree.root, "message-delete-confirm")).toBe(false);
    expect(api!.getThread("chad")).toBeDefined();
    expect(rowIds(tree)).toContain("chad");
    await persisted();
    expect(
      (await loadChat("demo")).threads.map((thread) => thread.id)
    ).toContain("chad");
  });

  it("confirming Delete friend removes the thread from the list and the on-device store, and it stays gone after relaunch", async () => {
    let tree = await mountList();

    swipeDelete(tree, "chad");
    confirmDelete(tree);

    expect(hasTestID(tree.root, "message-delete-confirm")).toBe(false);
    expect(api!.getThread("chad")).toBeUndefined();
    expect(rowIds(tree).sort()).toEqual(["amanda", "kevin"]);

    await persisted();
    const blob = await loadChat("demo");
    expect(blob.threads.map((thread) => thread.id).sort()).toEqual([
      "amanda",
      "kevin",
    ]);
    expect(blob.deletedThreadIds).toEqual(["chad"]);

    // Relaunch: the seeded Chad must not be merged back in.
    act(() => {
      trees.splice(0).forEach((item) => item.unmount());
    });
    tree = await mountList();
    expect(api!.getThread("chad")).toBeUndefined();
    expect(rowIds(tree).sort()).toEqual(["amanda", "kevin"]);
  });

  it("deleting every friend leaves an empty Message list that is still empty after relaunch", async () => {
    let tree = await mountList();
    for (const id of SEED_IDS) {
      swipeDelete(tree, id);
      confirmDelete(tree);
    }
    expect(rowIds(tree)).toEqual([]);
    expect(hasTestID(tree.root, "message-empty")).toBe(true);
    await persisted();

    act(() => {
      trees.splice(0).forEach((item) => item.unmount());
    });
    tree = await mountList();
    expect(api!.threads).toEqual([]);
    expect(rowIds(tree)).toEqual([]);
    expect(hasTestID(tree.root, "message-empty")).toBe(true);
  });

  it("a deleted friend can be added back through Add friends and then survives relaunch", async () => {
    let tree = await mountList();
    swipeDelete(tree, "chad");
    confirmDelete(tree);
    expect(api!.getThread("chad")).toBeUndefined();

    const chad = seedDirectory().find((person) => person.id === "chad")!;
    act(() => {
      api!.sendFriendRequest(chad);
    });
    expect(api!.getThread("chad")).toMatchObject({
      kind: "human",
      request: "sent",
    });
    expect(rowIds(tree)).toContain("chad");
    await persisted();

    act(() => {
      trees.splice(0).forEach((item) => item.unmount());
    });
    tree = await mountList();
    expect(api!.getThread("chad")).toMatchObject({
      kind: "human",
      request: "sent",
    });
    expect(rowIds(tree)).toContain("chad");
  });
});
