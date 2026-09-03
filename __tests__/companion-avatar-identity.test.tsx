import React, { ReactNode } from "react";
import { Image, Text, TouchableOpacity } from "react-native";
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
import { readFileSync } from "fs";
import { join } from "path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCREENS } from "../src/common/constant";
import { writeSessionUser } from "../src/backend/session";
import { loadChat, saveCompanions } from "../src/backend/store";
import { seedThreads } from "../src/backend/chat-seed";
import {
  Companion,
  CompanionsProvider,
  useCompanions,
} from "../src/store/companions";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import {
  findPerson,
  threadIdForCompanion,
} from "../src/screens/chat/person";
import { faceSourceForId, portraitPresetForId } from "../src/screens/chat/faces";
import type { ChatThread } from "../src/screens/chat/types";
import {
  LoveSessionProvider,
  useLoveSession,
} from "../src/screens/love/session";
import { clearLoveSessionBoot } from "../src/screens/love/session-persist";
import { resolveLovePerson } from "../src/screens/love/partner";
import { Home } from "../src/screens/home";
import { Chat } from "../src/screens/chat";
import { ChatThreadScreen } from "../src/screens/chat/thread";
import { ChatSettingsScreen } from "../src/screens/chat/settings";
import { LoveChatScreen } from "../src/screens/love/chat";
import { LoveCallScreen } from "../src/screens/love/call";
import { LookFace } from "../src/screens/avatar/look-face";
import { avatarOptions, companionFace } from "../src/screens/avatar/face";
import {
  PORTRAIT_IDS,
  PortraitId,
  portraitById,
} from "../src/screens/avatar/portraits";
import type { AvatarChoice } from "../src/screens/chat/types";
import {
  AvatarWizardProvider,
  DEFAULT_DRAFT,
} from "../src/screens/avatar/context";
import { useSaveCompanion } from "../src/screens/avatar/use-save-companion";
import {
  AvatarWaitingScreen,
  routesAfterCompanionSaved,
} from "../src/screens/avatar/waiting";

/**
 * TestFlight 1.2 (12), Maxwell's three screenshots: after crafting a 3D
 * "Kevin" the app (1) reset onto the dark Love overlay seeded with "Start
 * chatting with Kevin." — an empty black page to him; (2) Home showed the
 * crafted cartoon face; (3) tapping it opened his blue Message thread wearing
 * the old Kevin photo. Cause: the Message surfaces resolved the face from the
 * thread id alone (`faceSourceForId`) while Home/Love looked the 3D record up,
 * and the record (`companion-<ts>`) and the seeded thread (`kevin`) were paired
 * by name on Home only. These tests mount the real screens inside the app's
 * providers and read the face each one draws for the same person.
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
  dispatch: (action: unknown) => void;
  goBack: () => void;
  navigate: (name: string, params?: object) => void;
  canGoBack: () => boolean;
  getParent: () => FakeNavigation | undefined;
  setOptions: () => void;
  addListener: () => () => void;
  calls: { name: string; params?: object }[];
  dispatched: unknown[];
};

const fakeNavigation = (parent?: FakeNavigation): FakeNavigation => {
  const calls: { name: string; params?: object }[] = [];
  const dispatched: unknown[] = [];
  return {
    dispatch: jest.fn((action: unknown) => {
      dispatched.push(action);
    }),
    goBack: jest.fn(),
    navigate: jest.fn((name: string, params?: object) => {
      calls.push({ name, params });
    }),
    canGoBack: () => false,
    getParent: () => parent,
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => undefined),
    calls,
    dispatched,
  };
};

let homeStack: FakeNavigation = fakeNavigation();
let mockNavigation: FakeNavigation = fakeNavigation(homeStack);
// Several screens with different route params mount in one tree, so each is
// wrapped in a RouteContext provider that the useRoute mock reads.
jest.mock("@react-navigation/native", () => {
  const ReactModule = require("react");
  const routers = jest.requireActual("@react-navigation/routers") as {
    CommonActions: unknown;
  };
  const RouteContext = ReactModule.createContext({ name: "Home" });
  return {
    CommonActions: routers.CommonActions,
    RouteContext,
    useNavigation: () => mockNavigation,
    useRoute: () => ReactModule.useContext(RouteContext),
    useIsFocused: () => true,
  };
});
const { RouteContext } = jest.requireMock("@react-navigation/native") as {
  RouteContext: React.Context<{ name: string; params?: object }>;
};

const KEVIN_PHOTO = "message/kevin.png";
const SEED_IDS = seedThreads().map((thread) => thread.id);

type ChatApi = ReturnType<typeof useChat>;
type CompanionsApi = ReturnType<typeof useCompanions>;
type SessionApi = ReturnType<typeof useLoveSession>;
let chat: ChatApi | null = null;
let companionsApi: CompanionsApi | null = null;
let session: SessionApi | null = null;
const Probe = () => {
  chat = useChat();
  companionsApi = useCompanions();
  session = useLoveSession();
  return null;
};

let saveDraft: (() => Companion) | null = null;
const WizardProbe = () => {
  saveDraft = useSaveCompanion();
  return null;
};

const Routed = ({
  name,
  params,
  children,
}: {
  name: string;
  params?: object;
  children: ReactNode;
}) => (
  <RouteContext.Provider value={{ name, params }}>{children}</RouteContext.Provider>
);

type ScreensProps = {
  home?: boolean;
  list?: boolean;
  thread?: string;
  settings?: string;
  love?: string;
  loveCall?: string;
  wizard?: {
    companionId: string;
    name: string;
    // The Identity page's Choose avatar pick; the 3D look unless a test says.
    avatar?: AvatarChoice;
    waiting?: boolean;
  };
};

// The app's provider tree with the surfaces a test wants side by side.
const Screens = ({
  home = true,
  list = true,
  thread,
  settings,
  love,
  loveCall,
  wizard,
}: ScreensProps) => (
  <CompanionsProvider>
    <LoveSessionProvider>
      <ChatProvider>
        <Probe />
        {home ? (
          <Routed name={String(SCREENS.HOME)}>
            <Home />
          </Routed>
        ) : null}
        {list ? (
          <Routed name={String(SCREENS.CHAT)}>
            <Chat />
          </Routed>
        ) : null}
        {thread ? (
          <Routed name={String(SCREENS.CHAT_THREAD)} params={{ threadId: thread }}>
            <ChatThreadScreen />
          </Routed>
        ) : null}
        {settings ? (
          <Routed
            name={String(SCREENS.CHAT_SETTINGS)}
            params={{ threadId: settings }}
          >
            <ChatSettingsScreen />
          </Routed>
        ) : null}
        {love ? (
          <Routed name={String(SCREENS.LOVE_CHAT)} params={{ companionId: love }}>
            <LoveChatScreen />
          </Routed>
        ) : null}
        {loveCall ? (
          <Routed
            name={String(SCREENS.LOVE_CALL)}
            params={{ companionId: loveCall }}
          >
            <LoveCallScreen />
          </Routed>
        ) : null}
        {wizard ? (
          <AvatarWizardProvider
            mode="create"
            companionId={wizard.companionId}
            initialDraft={{
              ...DEFAULT_DRAFT,
              name: wizard.name,
              avatar: wizard.avatar ?? "look",
            }}
          >
            <WizardProbe />
            {wizard.waiting ? (
              <Routed name={String(SCREENS.AVATAR_WAITING)}>
                <AvatarWaitingScreen />
              </Routed>
            ) : null}
          </AvatarWizardProvider>
        ) : null}
      </ChatProvider>
    </LoveSessionProvider>
  </CompanionsProvider>
);

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
  clearLoveSessionBoot();
  return mountScreens(props);
};

const press = (node: ReactTestInstance) => {
  act(() => {
    node.props.onPress();
  });
};

const touchable = (root: ReactTestInstance, testID: string) => {
  const match = root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.testID === testID);
  if (!match) {
    throw new Error(`No TouchableOpacity with testID ${testID}`);
  }
  return match;
};

const buttonLabelled = (root: ReactTestInstance, label: string) => {
  const match = root
    .findAllByType(TouchableOpacity)
    .find((node) =>
      node
        .findAllByType(Text)
        .some(
          (text) =>
            React.Children.toArray(text.props.children).join("") === label
        )
    );
  if (!match) {
    throw new Error(`No button labelled ${label}`);
  }
  return match;
};

const texts = (root: ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map((node) => React.Children.toArray(node.props.children).join(""));

const uriOf = (source: unknown) =>
  (source as { testUri?: string } | undefined)?.testUri ?? String(source);

// What a LookFace will draw: the crafted look, or the portrait it falls back to.
type FaceSig =
  | { kind: "look"; look: unknown }
  | { kind: "portrait"; uri: string };

const signatureOf = (lookFace: ReactTestInstance): FaceSig =>
  lookFace.props.look
    ? { kind: "look", look: lookFace.props.look }
    : { kind: "portrait", uri: uriOf(lookFace.props.fallbackSource) };

const hostWithTestId = (root: ReactTestInstance, testID: string) => {
  const match = root.findAll((node) => node.props?.testID === testID)[0];
  if (!match) {
    throw new Error(`Nothing with testID ${testID}`);
  }
  return match;
};

const faceAt = (root: ReactTestInstance, testID: string): FaceSig =>
  signatureOf(hostWithTestId(root, testID).findByType(LookFace));

// Every surface that shows this person, in one object so a mismatch names
// the screen that disagrees.
const facesFor = (tree: ReactTestRenderer, id: string) => ({
  home: faceAt(tree.root, `home-companion-${id}`),
  messageRow: faceAt(tree.root, `message-row-${id}`),
  threadHeader: faceAt(tree.root, "chat-thread-header-face"),
  loveHeader: faceAt(tree.root, "love-chat-header-face"),
  lovePill: faceAt(tree.root, "love-pill"),
});

const expectOneFace = (
  tree: ReactTestRenderer,
  id: string,
  expected: FaceSig
) => {
  const faces = facesFor(tree, id);
  expect(faces).toEqual({
    home: expected,
    messageRow: expected,
    threadHeader: expected,
    loveHeader: expected,
    lovePill: expected,
  });
  return faces;
};

const imageUris = (node: ReactTestInstance) =>
  node.findAllByType(Image).map((image) => uriOf(image.props.source));

const kevinPhoto: FaceSig = {
  kind: "portrait",
  uri: uriOf(faceSourceForId("kevin")),
};

const isKevinPhoto = (uri: string) =>
  uri.endsWith(KEVIN_PHOTO) || uri.endsWith("love/call-face.png");

const craftKevin = async (tree: ReactTestRenderer) => {
  act(() => {
    saveDraft!();
  });
  await settle();
  return tree;
};

const nova: Companion = {
  ...DEFAULT_DRAFT,
  id: "companion-nova",
  name: "Nova",
  birthday: "01/01/2000",
  gender: "Male",
  personalities: ["Playful & whimsical"],
  story: "Made in the avatar wizard.",
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
  session = null;
  saveDraft = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
});

describe("one companion, one face on every surface", () => {
  it("seeded Kevin wears his photo on Home, the Message row, the thread header, the Love header and the pill", async () => {
    const tree = await mountScreens({ thread: "kevin", love: "kevin" });
    expectOneFace(tree, "kevin", kevinPhoto);
  });

  it("a 3D Kevin crafted in the wizard wears the crafted look everywhere, including his own Message thread header", async () => {
    const wizard = { companionId: "companion-k", name: "Kevin" };
    const tree = await craftKevin(await mountScreens({ wizard }));
    await update(tree, { wizard, thread: "kevin", love: "kevin" });

    const faces = facesFor(tree, "kevin");
    expect(faces.home.kind).toBe("look");
    expectOneFace(tree, "kevin", faces.home);
    // The thread header (screenshot 03) draws the SVG look, not kevin.png.
    expect(
      imageUris(hostWithTestId(tree.root, "chat-thread-header-face"))
    ).toEqual([]);
    // Still one Kevin on both lists.
    expect(texts(tree.root)).toContain("Kevin");
    expect(chat!.threads.filter((thread) => thread.name === "Kevin")).toHaveLength(1);
    // The record folded onto the seeded thread's id: one id, both stores.
    expect(companionsApi!.companions.map((companion) => companion.id)).toEqual([
      "kevin",
    ]);
    expect(chat!.getThread("kevin")?.avatar).toBe("look");
  });

  it("Maxwell's sequence: seeded Kevin deleted, then a 3D Kevin crafted — the recreated thread wears the look, not the old photo", async () => {
    const wizard = { companionId: "companion-k", name: "Kevin" };
    const tree = await mountScreens({ wizard });
    act(() => {
      chat!.deleteThread("kevin");
    });
    await settle();
    expect(chat!.getThread("kevin")).toBeUndefined();

    await craftKevin(tree);
    await update(tree, { wizard, thread: "kevin", love: "kevin" });

    const kevin = chat!.getThread("kevin");
    expect(kevin?.messages.map((message) => message.text)).toEqual([
      "Hey, it's Kevin. Start whenever you're ready.",
    ]);
    // The thread is minted under the seed id directly, never `companion-k`.
    expect(chat!.getThread("companion-k")).toBeUndefined();
    const faces = facesFor(tree, "kevin");
    expect(faces.threadHeader.kind).toBe("look");
    expectOneFace(tree, "kevin", faces.home);
  });

  it("a record saved before the fold (companion-k named Kevin) still pairs with thread kevin on every surface", async () => {
    await saveCompanions("demo", {
      companions: [{ ...nova, id: "companion-k", name: "Kevin" }],
      activeCompanionId: null,
    });
    const tree = await mountScreens({ thread: "kevin", love: "kevin" });

    const faces = facesFor(tree, "kevin");
    expect(faces.home.kind).toBe("look");
    expectOneFace(tree, "kevin", faces.home);
    expect(findPerson("kevin", chat!.threads, companionsApi!.companions)).toMatchObject({
      id: "kevin",
      companion: { id: "companion-k" },
      thread: { id: "kevin" },
    });
    expect(
      findPerson("companion-k", chat!.threads, companionsApi!.companions)
    ).toMatchObject({ id: "kevin", thread: { id: "kevin" } });
  });

  it("a crafted Nova never borrows Kevin's photo on the Message row or thread header", async () => {
    const wizard = { companionId: "companion-nova", name: "Nova" };
    const tree = await craftKevin(await mountScreens({ wizard }));
    await update(tree, {
      wizard,
      thread: "companion-nova",
      love: "companion-nova",
    });

    const faces = facesFor(tree, "companion-nova");
    expect(faces.home.kind).toBe("look");
    expectOneFace(tree, "companion-nova", faces.home);
    expect(
      imageUris(hostWithTestId(tree.root, "chat-thread-header-face"))
    ).toEqual([]);
    expect(
      imageUris(hostWithTestId(tree.root, "message-row-companion-nova"))
    ).toEqual([]);
  });

  it("Love voice call shows the person being called, not the stock call-face", async () => {
    const tree = await mountScreens({ home: false, list: false, loveCall: "amanda" });
    const uris = imageUris(tree.root);
    expect(uris).toContainEqual(uriOf(faceSourceForId("amanda")));
    expect(uris.filter(isKevinPhoto)).toEqual([]);
    expect(texts(tree.root)).toContain("Amanda");
  });
});

const portraitFace = (id: PortraitId): FaceSig => ({
  kind: "portrait",
  uri: uriOf(portraitById(id)!.source),
});

const avatarOptionIds = (root: ReactTestInstance) =>
  root
    .findAllByType(TouchableOpacity)
    .map((node) => String(node.props.testID ?? ""))
    .filter((id) => id.startsWith("avatar-option-"));

describe("the avatar picked in the create wizard is the companion's face", () => {
  it("a portrait picked on the Identity page shows on Home, the Message row, the thread header, the Love header and the pill", async () => {
    const wizard = { companionId: "companion-nova", name: "Nova", avatar: "m-calm" as const };
    const tree = await craftKevin(await mountScreens({ wizard }));
    await update(tree, { wizard, thread: "companion-nova", love: "companion-nova" });

    expectOneFace(tree, "companion-nova", portraitFace("m-calm"));
    expect(chat!.getThread("companion-nova")?.avatar).toBe("m-calm");
    // The record still carries the crafted look for the 3D option later.
    expect(companionsApi!.companions.map((companion) => companion.id)).toEqual([
      "companion-nova",
    ]);
  });

  it("a female portrait picked for a Kevin folded onto the seed thread beats both his old photo and the look", async () => {
    const wizard = { companionId: "companion-k", name: "Kevin", avatar: "f-bangs" as const };
    const tree = await craftKevin(await mountScreens({ wizard }));
    await update(tree, { wizard, thread: "kevin", love: "kevin" });
    expectOneFace(tree, "kevin", portraitFace("f-bangs"));
    expect(
      imageUris(hostWithTestId(tree.root, "chat-thread-header-face")).filter(isKevinPhoto)
    ).toEqual([]);
  });

  it("picking the 3D look in the wizard keeps the crafted cartoon everywhere", async () => {
    const wizard = { companionId: "companion-k", name: "Kevin", avatar: "look" as const };
    const tree = await craftKevin(await mountScreens({ wizard }));
    await update(tree, { wizard, thread: "kevin", love: "kevin" });
    const faces = facesFor(tree, "kevin");
    expect(faces.home.kind).toBe("look");
    expectOneFace(tree, "kevin", faces.home);
  });

  it("the wizard pick survives an app relaunch", async () => {
    const wizard = { companionId: "companion-nova", name: "Nova", avatar: "m-warm" as const };
    await craftKevin(await mountScreens({ wizard }));
    await persisted();
    expect(
      (await loadChat("demo")).threads.find((thread) => thread.id === "companion-nova")
        ?.avatar
    ).toBe("m-warm");
    const tree = await relaunch({ thread: "companion-nova", love: "companion-nova" });
    expectOneFace(tree, "companion-nova", portraitFace("m-warm"));
  });
});

describe("secondary avatar switch on Chat settings", () => {
  const wizard = { companionId: "companion-k", name: "Kevin" };

  it("offers the crafted look, the old photo and the male portraits; a pick changes Home, Message header and Love header together", async () => {
    const tree = await craftKevin(await mountScreens({ wizard }));
    await update(tree, {
      wizard,
      thread: "kevin",
      love: "kevin",
      settings: "kevin",
    });
    const look = facesFor(tree, "kevin").home;
    expect(look.kind).toBe("look");
    expect(avatarOptionIds(tree.root)).toEqual([
      "avatar-option-look",
      "avatar-option-portrait",
      "avatar-option-m-warm",
      "avatar-option-m-calm",
      "avatar-option-m-tousled",
    ]);
    expect(
      touchable(tree.root, "avatar-option-look").props.accessibilityState
    ).toEqual({ selected: true });

    press(touchable(tree.root, "avatar-option-portrait"));
    await settle();
    expectOneFace(tree, "kevin", kevinPhoto);
    expect(
      touchable(tree.root, "avatar-option-portrait").props.accessibilityState
    ).toEqual({ selected: true });
    expect(chat!.getThread("kevin")?.avatar).toBe("portrait");

    press(touchable(tree.root, "avatar-option-m-tousled"));
    await settle();
    expectOneFace(tree, "kevin", portraitFace("m-tousled"));
    expect(chat!.getThread("kevin")?.avatar).toBe("m-tousled");

    press(touchable(tree.root, "avatar-option-look"));
    await settle();
    expectOneFace(tree, "kevin", look);
  });

  it("picking a face is not chat activity: the Message row keeps its time", async () => {
    const tree = await craftKevin(await mountScreens({ wizard, settings: "kevin" }));
    const before = chat!.getThread("kevin")!.lastActivityAt;
    press(touchable(tree.root, "avatar-option-m-warm"));
    await settle();
    expect(chat!.getThread("kevin")!.lastActivityAt).toBe(before);
  });

  it("Love chat ··· no longer lists per-face switches; Edit persona leads to the Identity page grid", async () => {
    const tree = await craftKevin(await mountScreens({ wizard }));
    await update(tree, { wizard, thread: "kevin", love: "kevin" });
    press(touchable(tree.root, "love-chat-info"));
    const labels = texts(tree.root);
    expect(labels).not.toContain("Use photo");
    expect(labels).not.toContain("Use 3D avatar");
    expect(labels).toContain("Edit persona");
    expect(labels).toContain("Edit avatar");
  });

  it("seeded Chad (no 3D record) can switch between his photo and the male portraits", async () => {
    const tree = await mountScreens({ settings: "chad" });
    expect(avatarOptionIds(tree.root)).toEqual([
      "avatar-option-portrait",
      "avatar-option-m-warm",
      "avatar-option-m-calm",
      "avatar-option-m-tousled",
    ]);
    press(touchable(tree.root, "avatar-option-m-calm"));
    await settle();
    expect(chat!.getThread("chad")?.avatar).toBe("m-calm");
    expect(faceAt(tree.root, "home-companion-chad")).toEqual(portraitFace("m-calm"));
    expect(faceAt(tree.root, "message-row-chad")).toEqual(portraitFace("m-calm"));
  });

  it("the pick survives an app relaunch", async () => {
    let tree = await craftKevin(await mountScreens({ wizard, settings: "kevin" }));
    press(touchable(tree.root, "avatar-option-portrait"));
    await persisted();
    expect(
      (await loadChat("demo")).threads.find((thread) => thread.id === "kevin")
        ?.avatar
    ).toBe("portrait");

    tree = await relaunch({ thread: "kevin", love: "kevin" });
    expectOneFace(tree, "kevin", kevinPhoto);
    expect(companionsApi!.companions.map((companion) => companion.id)).toEqual([
      "kevin",
    ]);

    // And the look comes back when picked again, across another relaunch.
    act(() => {
      chat!.setAvatar("kevin", "look");
    });
    await persisted();
    tree = await relaunch({ thread: "kevin", love: "kevin" });
    expect(facesFor(tree, "kevin").threadHeader.kind).toBe("look");
  });

  it("re-crafting the look makes it the face again until the user picks otherwise", async () => {
    const tree = await craftKevin(await mountScreens({ wizard, settings: "kevin" }));
    press(touchable(tree.root, "avatar-option-portrait"));
    await settle();
    expect(chat!.getThread("kevin")?.avatar).toBe("portrait");
    await craftKevin(tree);
    expect(chat!.getThread("kevin")?.avatar).toBe("look");
  });
});

describe("finishing the 3D craft lands on the companion's chat, not the dark Love page", () => {
  const waitForLanding = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1900));
      await flush();
    });

  const resetAction = (nav: FakeNavigation) => {
    expect(nav.dispatched).toHaveLength(1);
    return nav.dispatched[0] as {
      type: string;
      payload: { index: number; routes: { name: string; params?: object }[] };
    };
  };

  // The stores hydrate at app launch, long before anyone reaches the wizard;
  // mount them first, then push the Waiting step like the candle does.
  const reachWaiting = async (wizard: { companionId: string; name: string }) => {
    const tree = await mountScreens({ home: false, list: false, wizard });
    await update(tree, {
      home: false,
      list: false,
      wizard: { ...wizard, waiting: true },
    });
    return tree;
  };

  it("Kevin: Home under his Message thread, no LoveChat, no Love session started", async () => {
    const tree = await reachWaiting({ companionId: "companion-k", name: "Kevin" });
    expect(texts(tree.root)).toContain("Saving Kevin…");
    await waitForLanding();

    const action = resetAction(homeStack);
    expect(action.type).toBe("RESET");
    expect(action.payload.routes).toEqual([
      { name: String(SCREENS.NAV_BAR) },
      { name: String(SCREENS.CHAT_THREAD), params: { threadId: "kevin" } },
    ]);
    expect(action.payload.index).toBe(1);
    expect(action.payload.routes.map((route) => route.name)).not.toContain(
      String(SCREENS.LOVE_CHAT)
    );
    expect(session).toMatchObject({ layer: null, minimized: false });
    expect(session?.companionId).toBeUndefined();
    // Saved once: record and thread share the seed id, the look is the face.
    expect(companionsApi!.companions.map((companion) => companion.id)).toEqual([
      "kevin",
    ]);
    expect(chat!.getThread("kevin")).toMatchObject({ name: "Kevin", avatar: "look" });
  });

  it("Nova: the new thread id is the companion id", async () => {
    await reachWaiting({ companionId: "companion-nova", name: "Nova" });
    await waitForLanding();

    const action = resetAction(homeStack);
    expect(action.payload.routes).toEqual([
      { name: String(SCREENS.NAV_BAR) },
      {
        name: String(SCREENS.CHAT_THREAD),
        params: { threadId: "companion-nova" },
      },
    ]);
    expect(chat!.getThread("companion-nova")?.name).toBe("Nova");
  });

  it("the landing stack is Home → thread so back returns Home", () => {
    expect(routesAfterCompanionSaved("kevin").map((route) => route.name)).toEqual([
      String(SCREENS.NAV_BAR),
      String(SCREENS.CHAT_THREAD),
    ]);
  });

  it("the Waiting step no longer starts a Love session or targets LoveChat", () => {
    const source = readFileSync(
      join(__dirname, "../src/screens/avatar/waiting.tsx"),
      "utf8"
    );
    expect(source).not.toContain("LOVE_CHAT");
    expect(source).not.toContain("useLoveSession");
    expect(source).not.toContain("fromCreation");
    expect(source).toContain("SCREENS.CHAT_THREAD");
  });
});

describe("face rules", () => {
  const kevinThread = seedThreads()[0];
  const kevin3d: Companion = { ...nova, id: "companion-k", name: "Kevin" };

  it("the crafted look wins by default; the photo only when picked and owned", () => {
    expect(companionFace({ thread: kevinThread }).kind).toBe("portrait");
    expect(companionFace({ thread: kevinThread, companion: kevin3d }).kind).toBe(
      "look"
    );
    expect(
      companionFace({
        thread: { ...kevinThread, avatar: "portrait" },
        companion: kevin3d,
      })
    ).toMatchObject({ kind: "portrait", look: null, source: faceSourceForId("kevin") });
    expect(
      companionFace({
        thread: { ...kevinThread, avatar: "look" },
        companion: kevin3d,
      }).kind
    ).toBe("look");
  });

  it("a crafted companion without a photo keeps the look even if 'portrait' is stored", () => {
    const novaThread: ChatThread = {
      ...kevinThread,
      id: "companion-nova",
      name: "Nova",
      avatar: "portrait",
    };
    expect(companionFace({ thread: novaThread, companion: nova }).kind).toBe("look");
    // Nova is Male: the look, then the male portraits; never Kevin's photo.
    expect(avatarOptions({ thread: novaThread, companion: nova }).map((o) => o.kind)).toEqual(
      ["look", "m-warm", "m-calm", "m-tousled"]
    );
    expect(portraitPresetForId("companion-nova")).toBeNull();
  });

  it("options: seeded person = photo + portraits for their gender; crafted seeded-name = look + photo + portraits", () => {
    expect(avatarOptions({ thread: kevinThread }).map((o) => o.kind)).toEqual([
      "portrait",
      "m-warm",
      "m-calm",
      "m-tousled",
    ]);
    expect(
      avatarOptions({ thread: kevinThread, companion: kevin3d }).map((o) => o.kind)
    ).toEqual(["look", "portrait", "m-warm", "m-calm", "m-tousled"]);
    const amanda = seedThreads().find((thread) => thread.id === "amanda")!;
    expect(amanda.gender).toBe("Female");
    expect(avatarOptions({ thread: amanda }).map((o) => o.kind)).toEqual([
      "portrait",
      "f-bangs",
      "f-long",
    ]);
    // Non-binary (and unknown gender) sees all six.
    expect(
      avatarOptions({
        thread: { ...kevinThread, gender: "Non-binary" },
        companion: { ...kevin3d, gender: "Non-binary" },
      }).map((o) => o.kind)
    ).toEqual(["look", "portrait", ...PORTRAIT_IDS]);
    expect(
      avatarOptions({ thread: { ...kevinThread, gender: undefined } }).map((o) => o.kind)
    ).toEqual(["portrait", ...PORTRAIT_IDS]);
  });

  it("options carry English labels and the portrait image", () => {
    const options = avatarOptions({ thread: kevinThread, companion: kevin3d });
    expect(options.map((o) => o.label)).toEqual([
      "3D avatar",
      "Photo",
      "Warm",
      "Calm",
      "Tousled",
    ]);
    const warm = options.find((o) => o.kind === "m-warm")!;
    expect(warm.face).toEqual({
      kind: "m-warm",
      look: null,
      source: portraitById("m-warm")!.source,
    });
  });

  it("a pick that the gender filter would hide stays offered, so a gender change never strands the selection", () => {
    expect(
      avatarOptions({ thread: kevinThread, companion: kevin3d, choice: "f-long" }).map(
        (o) => o.kind
      )
    ).toEqual(["look", "portrait", "m-warm", "m-calm", "m-tousled", "f-long"]);
    // An explicit gender override (the wizard's draft) beats the stored one.
    expect(
      avatarOptions({ thread: kevinThread, companion: kevin3d, gender: "Female" }).map(
        (o) => o.kind
      )
    ).toEqual(["look", "portrait", "f-bangs", "f-long"]);
  });

  it("a bundled portrait pick wins over the look and the photo, for crafted and chat-only people alike", () => {
    const warm = portraitById("m-warm")!;
    expect(
      companionFace({ thread: { ...kevinThread, avatar: "m-warm" }, companion: kevin3d })
    ).toEqual({ kind: "m-warm", look: null, source: warm.source });
    expect(companionFace({ thread: { ...kevinThread, avatar: "f-long" } })).toEqual({
      kind: "f-long",
      look: null,
      source: portraitById("f-long")!.source,
    });
    // The picker preview overrides the stored pick.
    expect(
      companionFace({ thread: { ...kevinThread, avatar: "m-warm" }, choice: "look", companion: kevin3d })
        .kind
    ).toBe("look");
    // A stored id nothing ships for falls back to the default rule.
    expect(
      companionFace({
        thread: { ...kevinThread, avatar: "portrait-gone" as ChatThread["avatar"] },
        companion: kevin3d,
      }).kind
    ).toBe("look");
    expect(
      companionFace({ thread: { ...kevinThread, avatar: "portrait-gone" as ChatThread["avatar"] } })
    ).toMatchObject({ kind: "portrait", source: faceSourceForId("kevin") });
  });

  it("threadIdForCompanion folds seeded names and keeps everyone else's id", () => {
    expect(threadIdForCompanion({ id: "companion-k", name: "Kevin" })).toBe("kevin");
    expect(threadIdForCompanion({ id: "companion-k", name: " kevin " })).toBe("kevin");
    expect(threadIdForCompanion({ id: "companion-nova", name: "Nova" })).toBe(
      "companion-nova"
    );
  });

  it("resolveLovePerson pairs a record id with its folded thread and keys the session on the thread id", () => {
    const threads = seedThreads();
    const person = resolveLovePerson({
      companionId: "companion-k",
      companions: [kevin3d],
      threads,
      activeCompanion: null,
    });
    expect(person.companionId).toBe("kevin");
    expect(person.companion?.id).toBe("companion-k");
    expect(person.thread?.id).toBe("kevin");
    const fromThread = resolveLovePerson({
      companionId: "kevin",
      companions: [kevin3d],
      threads,
      activeCompanion: null,
    });
    expect(fromThread.companion?.id).toBe("companion-k");
  });
});

describe("no surface hard-codes a stock face", () => {
  it.each([
    "src/screens/chat/thread.tsx",
    "src/screens/chat/index.tsx",
    "src/screens/chat/call.tsx",
    "src/screens/love/chat.tsx",
    "src/screens/love/call.tsx",
    "src/screens/love/sync.tsx",
    "src/screens/love/pill.tsx",
    "src/screens/home/index.tsx",
  ])("%s resolves the person's face instead of faceSourceForId / call-face.png", (file) => {
    const source = readFileSync(join(__dirname, "..", file), "utf8");
    expect(source).not.toContain("faceSourceForId(");
    expect(source).not.toContain("call-face.png");
  });

  it("Home lists the same people as Message", async () => {
    const tree = await mountScreens();
    const ids = (prefix: string) =>
      tree.root
        .findAllByType(TouchableOpacity)
        .map((node) => String(node.props.testID ?? ""))
        .filter((id) => id.startsWith(prefix))
        .map((id) => id.slice(prefix.length))
        .filter((id) => !/^(unread|delete|time)-/.test(id));
    expect(ids("home-companion-")).toEqual(SEED_IDS);
    expect(ids("message-row-")).toEqual(SEED_IDS);
  });
});
