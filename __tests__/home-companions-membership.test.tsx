import React from "react";
import { TouchableOpacity } from "react-native";
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
import { loadChat, loadCompanions } from "../src/backend/store";
import { seedThreads } from "../src/backend/chat-seed";
import {
  Companion,
  CompanionsProvider,
  useCompanions,
} from "../src/store/companions";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import { messageFriends } from "../src/screens/chat/friends";
import type { ChatThread } from "../src/screens/chat/types";
import { LoveSessionProvider } from "../src/screens/love/session";
import { clearLoveSessionBoot } from "../src/screens/love/session-persist";
import { Home } from "../src/screens/home";
import { homeCompanions } from "../src/screens/home/companions";
import { Chat } from "../src/screens/chat";
import { LookFace } from "../src/screens/avatar/look-face";
import {
  AvatarWizardProvider,
  DEFAULT_DRAFT,
} from "../src/screens/avatar/context";
import { useSaveCompanion } from "../src/screens/avatar/use-save-companion";

/**
 * TestFlight 1.2 (11): Kevin deleted from the Message list (swipe → Delete
 * friend → confirm) stayed in Home "My Companions", because Home rendered a
 * static Kevin/Chad/Amanda catalog plus the 3D companion store and never
 * looked at the chat store's threads or tombstones. Home and Message must be
 * one membership: these tests walk both screens inside the same providers
 * the app mounts, delete a friend on Message, and read Home before and after
 * leaving the screen and relaunching.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-linear-gradient", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View };
});
jest.mock("@react-native-community/blur", () => {
  const { View } = require("react-native");
  return { BlurView: View };
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
jest.mock("react-native-webview", () => ({ WebView: "MockWebView" }));
jest.mock("../src/native/ph-native", () => ({
  bundledAvatarViewerUrl: () => "file:///avatar-engine/viewer-page.html",
}));

type FakeNavigation = {
  goBack: () => void;
  navigate: (name: string, params?: object) => void;
  getParent: () => FakeNavigation | undefined;
  calls: { name: string; params?: object }[];
};

const fakeNavigation = (parent?: FakeNavigation): FakeNavigation => {
  const calls: { name: string; params?: object }[] = [];
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
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ name: "Home" }),
  useIsFocused: () => true,
}));

const SEED_IDS = seedThreads().map((thread) => thread.id);

type ChatApi = ReturnType<typeof useChat>;
type CompanionsApi = ReturnType<typeof useCompanions>;
let chat: ChatApi | null = null;
let companionsApi: CompanionsApi | null = null;
const Probe = () => {
  chat = useChat();
  companionsApi = useCompanions();
  return null;
};

// The create wizard's Waiting step saves through useSaveCompanion; this
// mounts that hook with the draft the wizard would hold.
let saveDraft: (() => Companion) | null = null;
const WizardProbe = () => {
  saveDraft = useSaveCompanion();
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

type ScreensProps = {
  home?: boolean;
  wizard?: { companionId: string; name: string };
};

// Home and Message tabs side by side in the app's provider tree. `home`
// false simulates leaving the Home tab; the wizard probe stands in for the
// avatar wizard when a test creates a companion.
const Screens = ({ home = true, wizard }: ScreensProps) => (
  <CompanionsProvider>
    <LoveSessionProvider>
      <ChatProvider>
        <Probe />
        {home ? <Home /> : null}
        <Chat />
        {wizard ? (
          <AvatarWizardProvider
            mode="create"
            companionId={wizard.companionId}
            initialDraft={{ ...DEFAULT_DRAFT, name: wizard.name }}
          >
            <WizardProbe />
          </AvatarWizardProvider>
        ) : null}
      </ChatProvider>
    </LoveSessionProvider>
  </CompanionsProvider>
);

const mountScreens = async (props: ScreensProps = {}) => {
  homeStack = fakeNavigation();
  mockNavigation = fakeNavigation(homeStack);
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Screens {...props} />);
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

const update = async (tree: ReactTestRenderer, props: ScreensProps) => {
  act(() => {
    tree.update(<Screens {...props} />);
  });
  await settle();
};

// App relaunch: every provider unmounts and hydrates again from AsyncStorage.
const relaunch = async (props: ScreensProps = {}) => {
  act(() => {
    trees.splice(0).forEach((item) => item.unmount());
  });
  return mountScreens(props);
};

const press = (node: ReactTestInstance) => {
  act(() => {
    node.props.onPress();
  });
};

const touchables = (root: ReactTestInstance) =>
  root.findAllByType(TouchableOpacity);

const touchable = (root: ReactTestInstance, testID: string) => {
  const match = touchables(root).find((node) => node.props.testID === testID);
  if (!match) {
    throw new Error(`No TouchableOpacity with testID ${testID}`);
  }
  return match;
};

const idsWithPrefix = (tree: ReactTestRenderer, prefix: string) =>
  touchables(tree.root)
    .map((node) => String(node.props.testID ?? ""))
    .filter((id) => id.startsWith(prefix))
    .map((id) => id.slice(prefix.length));

// Faces in Home "My Companions", in row order.
const homeIds = (tree: ReactTestRenderer) =>
  idsWithPrefix(tree, "home-companion-");

// Rows in the Message list, in row order (the swipe-action buttons carry
// other prefixes).
const messageIds = (tree: ReactTestRenderer) =>
  idsWithPrefix(tree, "message-row-").filter(
    (id) => !/^(unread|delete|time)-/.test(id)
  );

const homeFaceLook = (tree: ReactTestRenderer, id: string) =>
  touchable(tree.root, `home-companion-${id}`).findByType(LookFace).props
    .look as unknown;

const swipeDeleteAndConfirm = (tree: ReactTestRenderer, threadId: string) => {
  press(touchable(tree.root, `message-row-delete-${threadId}`));
  press(touchable(tree.root, "message-delete-confirm-primary"));
};

const expectSameMembership = (tree: ReactTestRenderer) => {
  expect(homeIds(tree)).toEqual(messageIds(tree));
  expect(homeIds(tree)).toEqual(
    homeCompanions(chat!.threads, companionsApi!.companions).map(
      (companion) => companion.id
    )
  );
};

beforeEach(async () => {
  await AsyncStorage.clear();
  clearLoveSessionBoot();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  chat = null;
  companionsApi = null;
  saveDraft = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
});

describe("Home My Companions is the Message friends list", () => {
  it("shows the same people in the same order as the Message list", async () => {
    const tree = await mountScreens();
    expect(homeIds(tree)).toEqual(SEED_IDS);
    expectSameMembership(tree);
    // Seeded people have no 3D record: stock portrait, not a crafted look.
    for (const id of SEED_IDS) {
      expect(homeFaceLook(tree, id)).toBeNull();
    }
  });

  it("tapping a Home face opens that person's Message thread", async () => {
    const tree = await mountScreens();
    press(touchable(tree.root, "home-companion-chad"));
    expect(homeStack.calls).toEqual([
      { name: String(SCREENS.CHAT_THREAD), params: { threadId: "chad" } },
    ]);
  });
});

describe("Delete friend on Message removes the person from Home", () => {
  it("hides Kevin on Home in the same render, and after leaving Home and coming back", async () => {
    const tree = await mountScreens();
    expect(homeIds(tree)).toContain("kevin");

    swipeDeleteAndConfirm(tree, "kevin");

    expect(chat!.getThread("kevin")).toBeUndefined();
    expect(messageIds(tree)).toEqual(["chad", "amanda"]);
    expect(homeIds(tree)).toEqual(["chad", "amanda"]);
    expectSameMembership(tree);

    // Leave the Home tab and come back: Home re-reads the shared list.
    await update(tree, { home: false });
    expect(homeIds(tree)).toEqual([]);
    await update(tree, { home: true });
    expect(homeIds(tree)).toEqual(["chad", "amanda"]);
    expectSameMembership(tree);
  });

  it("keeps Kevin off Home after the app relaunches: the tombstone beats the seed", async () => {
    let tree = await mountScreens();
    expect(homeIds(tree)).toEqual(SEED_IDS);
    swipeDeleteAndConfirm(tree, "kevin");
    await persisted();
    expect((await loadChat("demo")).deletedThreadIds).toEqual(["kevin"]);

    tree = await relaunch();
    expect(chat!.getThread("kevin")).toBeUndefined();
    expect(homeIds(tree)).toEqual(["chad", "amanda"]);
    expectSameMembership(tree);

    // A second relaunch must not resurrect him either.
    tree = await relaunch();
    expect(homeIds(tree)).toEqual(["chad", "amanda"]);
    expectSameMembership(tree);
  });

  it("deleting every friend leaves Home My Companions with only the + button, also after relaunch", async () => {
    let tree = await mountScreens();
    expect(homeIds(tree)).toEqual(SEED_IDS);
    for (const id of SEED_IDS) {
      swipeDeleteAndConfirm(tree, id);
    }
    expect(homeIds(tree)).toEqual([]);
    expect(messageIds(tree)).toEqual([]);
    // The + entry stays so a companion can still be created.
    expect(touchable(tree.root, "home-add-companion")).toBeDefined();
    await persisted();

    tree = await relaunch();
    expect(chat!.threads).toEqual([]);
    expect(homeIds(tree)).toEqual([]);
    expectSameMembership(tree);
  });
});

describe("creating a companion adds the person to both screens", () => {
  const wizard = { companionId: "companion-nova", name: "Nova" };
  // Inbox order: pinned Kevin first, then the newest thread, then the seeds.
  const WITH_NOVA = ["kevin", "companion-nova", "chad", "amanda"];

  it("a companion saved by the create wizard shows on Home with its 3D look and on Message", async () => {
    let tree = await mountScreens({ wizard });

    act(() => {
      saveDraft!();
    });
    await settle();

    expect(homeIds(tree)).toEqual(WITH_NOVA);
    expectSameMembership(tree);
    // The crafted look comes from the companions store; seeds stay stock.
    expect(homeFaceLook(tree, "companion-nova")).not.toBeNull();
    expect(homeFaceLook(tree, "kevin")).toBeNull();

    await persisted();
    tree = await relaunch({ wizard });
    expect(homeIds(tree)).toEqual(WITH_NOVA);
    expect(homeFaceLook(tree, "companion-nova")).not.toBeNull();
    expectSameMembership(tree);
  });

  it("deleting a created companion on Message hides them on Home too; the 3D record is kept, not shown", async () => {
    let tree = await mountScreens({ wizard });
    act(() => {
      saveDraft!();
    });
    await settle();

    swipeDeleteAndConfirm(tree, "companion-nova");

    expect(homeIds(tree)).toEqual(SEED_IDS);
    expectSameMembership(tree);
    expect(
      companionsApi!.companions.map((companion) => companion.id)
    ).toEqual(["companion-nova"]);

    await persisted();
    tree = await relaunch({ wizard });
    expect(homeIds(tree)).toEqual(SEED_IDS);
    expectSameMembership(tree);
    expect(
      (await loadCompanions("demo")).companions.map(
        (companion: Companion) => companion.id
      )
    ).toEqual(["companion-nova"]);
  });

  it("a 3D companion named Kevin is one Kevin on Home, wearing the crafted look", async () => {
    // The chat store folds a bot named after a seed into that seed's thread
    // (id "kevin"), so the companion record and the thread have different
    // ids. Home used to draw both: the 3D Kevin and the mock Kevin.
    const tree = await mountScreens({
      wizard: { companionId: "companion-k", name: "Kevin" },
    });
    act(() => {
      saveDraft!();
    });
    await settle();

    expect(messageIds(tree).filter((id) => id === "kevin")).toHaveLength(1);
    expect(messageIds(tree)).not.toContain("companion-k");
    expect(homeIds(tree)).toEqual(SEED_IDS);
    expectSameMembership(tree);
    expect(homeFaceLook(tree, "kevin")).not.toBeNull();
  });
});

describe("homeCompanions selector", () => {
  const nova = {
    ...DEFAULT_DRAFT,
    id: "companion-nova",
    name: "Nova",
    birthday: "01/01/2000",
    gender: "Male",
    personalities: ["Playful & whimsical"],
    story: "Made in the avatar wizard.",
  } as Companion;

  it("keeps the Message list's filter and order", () => {
    const refused: ChatThread = {
      ...seedThreads()[1],
      id: "refused-guy",
      name: "Refused",
      kind: "human",
      request: "refused",
    };
    const threads = [refused, ...seedThreads()];
    expect(homeCompanions(threads, []).map((item) => item.id)).toEqual(
      messageFriends(threads).map((thread) => thread.id)
    );
    expect(homeCompanions(threads, []).map((item) => item.id)).toEqual(
      SEED_IDS
    );
  });

  it("does not list a companion record that has no thread", () => {
    // A deleted friend's 3D record is orphan data, not a Home companion.
    expect(homeCompanions(seedThreads(), [nova]).map((item) => item.id)).toEqual(
      SEED_IDS
    );
  });

  it("pairs a thread with its companion record by id, else by the seeded-name rule", () => {
    const novaThread: ChatThread = {
      ...seedThreads()[0],
      id: "companion-nova",
      name: "Nova",
      pinned: false,
    };
    const kevin3d = { ...nova, id: "companion-k", name: "Kevin" } as Companion;
    const rows = homeCompanions(
      [novaThread, ...seedThreads()],
      [nova, kevin3d]
    );
    expect(rows.map((item) => [item.id, item.look !== null])).toEqual([
      ["kevin", true],
      ["companion-nova", true],
      ["chad", false],
      ["amanda", false],
    ]);
  });
});
