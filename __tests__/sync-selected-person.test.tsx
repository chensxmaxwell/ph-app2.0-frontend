import React, { ReactNode } from "react";
import { Image, Text, TouchableOpacity } from "react-native";
import Svg from "react-native-svg";
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
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from "../src/common/constant";
import { writeSessionUser } from "../src/backend/session";
import { saveCompanions } from "../src/backend/store";
import { Companion, CompanionsProvider } from "../src/store/companions";
import { ChatProvider } from "../src/screens/chat/store";
import { faceSourceForId } from "../src/screens/chat/faces";
import {
  LoveSessionProvider,
  useLoveSession,
} from "../src/screens/love/session";
import { clearLoveSessionBoot } from "../src/screens/love/session-persist";
import { LoveSyncScreen } from "../src/screens/love/sync";
import SyncScreen from "../src/screens/sync/sync_screen";
import SyncStack from "../src/screens/sync/sync_stack";

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
jest.mock("../src/hooks/usePatternPlayer", () => ({
  usePatternPlayer: () => ({
    playing: false,
    cursor: 0,
    start: jest.fn(),
    stop: jest.fn(),
    toggle: jest.fn(),
  }),
}));
// SyncStack registers the picker, whose ConnectionPill drags the BLE stack in
// at import time. The picker is never rendered here.
jest.mock("../src/common/components/connection-pill", () => ({
  ConnectionPill: () => null,
}));
// Enough of a native stack to read what SyncStack hands its screens.
jest.mock("@react-navigation/native-stack", () => {
  const ReactModule = require("react");
  const Navigator = ({ children }: { children: unknown }) =>
    ReactModule.createElement(ReactModule.Fragment, null, children);
  const Screen = () => null;
  return { createNativeStackNavigator: () => ({ Navigator, Screen }) };
});
const { Navigator: StackNavigator, Screen: StackScreen } =
  createNativeStackNavigator();

type FakeNavigation = {
  dispatch: () => void;
  goBack: () => void;
  navigate: () => void;
  getParent: () => FakeNavigation | undefined;
  setOptions: () => void;
  addListener: () => () => void;
};

const fakeNavigation = (parent?: FakeNavigation): FakeNavigation => ({
  dispatch: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  getParent: () => parent,
  setOptions: jest.fn(),
  addListener: jest.fn(() => () => undefined),
});

let mockNavigation: FakeNavigation = fakeNavigation();
let mockRoute: { name: string; params?: object } = {
  name: String(SCREENS.NAV_BAR),
};
jest.mock("@react-navigation/native", () => {
  const routers = jest.requireActual("@react-navigation/routers") as {
    CommonActions: unknown;
  };
  return {
    CommonActions: routers.CommonActions,
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useIsFocused: () => true,
  };
});

const SYNC_SCREEN = String(SCREENS.SYNC_SCREEN);
const LOVE_SYNC = String(SCREENS.LOVE_SYNC);

type LoveSessionApi = ReturnType<typeof useLoveSession>;
let session: LoveSessionApi | null = null;
const Probe = () => {
  session = useLoveSession();
  return null;
};

const Providers = ({ children }: { children: ReactNode }) => (
  <CompanionsProvider>
    <LoveSessionProvider>
      <ChatProvider>
        <Probe />
        {children}
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

const trees: ReactTestRenderer[] = [];

const mount = async (children: ReactNode) => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Providers>{children}</Providers>);
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

const show = async (tree: ReactTestRenderer, children: ReactNode) => {
  act(() => {
    tree.update(<Providers>{children}</Providers>);
  });
  await settle();
};

const press = (node: ReactTestInstance) => {
  act(() => {
    node.props.onPress();
  });
};

const byTestId = (tree: ReactTestRenderer, testID: string) => {
  const match = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.testID === testID);
  if (!match) {
    throw new Error(`No TouchableOpacity with testID ${testID}`);
  }
  return match;
};

const imageSources = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Image).map((node) => node.props.source);

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => React.Children.toArray(node.props.children).join(""));

// Every bundled portrait of Kevin. `message/kevin-photo.png` is Chad's photo
// despite the file name, so match `message/kevin.png` on its own.
const isKevinPortrait = (source: unknown) => {
  const uri = (source as { testUri?: string } | undefined)?.testUri ?? "";
  return (
    /(^|\/)avatar-ring\.png$/.test(uri) ||
    /(^|\/)love\/call-face\.png$/.test(uri) ||
    /(^|\/)message\/kevin\.png$/.test(uri)
  );
};

const expectFaceOf = (tree: ReactTestRenderer, companionId: string) => {
  const sources = imageSources(tree);
  expect(sources).toContainEqual(faceSourceForId(companionId));
  expect(sources.filter(isKevinPortrait)).toEqual([]);
};

const expectNoKevinPortrait = (tree: ReactTestRenderer) => {
  expect(imageSources(tree).filter(isKevinPortrait)).toEqual([]);
};

const nova: Companion = {
  id: "created-nova",
  name: "Nova",
  birthday: "01/01/2000",
  gender: "Male",
  personalities: ["Playful & whimsical"],
  story: "Made in the avatar wizard.",
  passionateTender: 50,
  dominantSubmissive: 50,
  experimentalVanilla: 50,
  appearanceIndex: 1,
  hairStyle: 1,
  hairColor: 1,
  skinTone: 1,
  eyeColor: 3,
  upperArms: 0,
  chest: 0,
  forearms: 0,
  backAndHips: 0,
  faceWidth: 0,
  jaw: 0,
  chin: 0,
  eyeSize: 0,
  age: 0,
};

// What the avatar wizard leaves behind: the companion persisted under the
// signed-in user, which CompanionsProvider hydrates from on mount.
const persistCreatedCompanion = (companion: Companion) =>
  saveCompanions("demo", { companions: [companion], activeCompanionId: null });

const SeedSession = ({
  companionId,
  name,
  surface,
}: {
  companionId: string;
  name: string;
  surface: "love" | "message" | "control";
}) => {
  const { start } = useLoveSession();
  React.useEffect(() => {
    start({ layer: "sync", surface, companionId, name });
  }, [companionId, name, start, surface]);
  return null;
};

const mountControlSyncFor = async (companionId: string, name: string) => {
  // Control hub → Sync card → picker row → SyncScreen inside the SyncStack.
  mockNavigation = fakeNavigation(fakeNavigation());
  mockRoute = { name: SYNC_SCREEN, params: { name, companionId } };
  return mount(<SyncScreen />);
};

beforeEach(async () => {
  await AsyncStorage.clear();
  clearLoveSessionBoot();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  session = null;
  mockNavigation = fakeNavigation();
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
});

describe("Control hub Sync shows the person that was picked", () => {
  it.each([
    ["Amanda", "amanda"],
    ["Chad", "chad"],
  ])(
    "shows %s's face and name on the live Sync screen, not Kevin's",
    async (name, companionId) => {
      const tree = await mountControlSyncFor(companionId, name);

      expect(texts(tree)).toContain(name);
      expectFaceOf(tree, companionId);
    }
  );

  it("still shows Kevin when Kevin is the one picked", async () => {
    const tree = await mountControlSyncFor("kevin", "Kevin");

    expect(texts(tree)).toContain("Kevin");
    expect(imageSources(tree)).toContainEqual(faceSourceForId("kevin"));
  });

  it("renders a created companion's own look instead of a stock portrait", async () => {
    await persistCreatedCompanion(nova);
    const tree = await mountControlSyncFor(nova.id, nova.name);

    expect(texts(tree)).toContain("Nova");
    expect(tree.root.findAllByType(Svg).length).toBeGreaterThan(0);
    expectNoKevinPortrait(tree);
  });
});

describe("Sync overlay after minimize → pill restore keeps the picked person", () => {
  it("binds the session and the restored LoveSync overlay to Amanda", async () => {
    const tree = await mountControlSyncFor("amanda", "Amanda");

    press(byTestId(tree, "control-sync-minimize"));
    await settle();
    expect(session).toMatchObject({
      layer: "sync",
      minimized: true,
      surface: "control",
      companionId: "amanda",
    });
    expect(session?.chat?.name).toBe("Amanda");

    // The global pill restores `NavBar → LoveSync` with the session's person.
    mockNavigation = fakeNavigation();
    mockRoute = {
      name: LOVE_SYNC,
      params: { companionId: "amanda", name: "Amanda" },
    };
    await show(tree, <LoveSyncScreen />);

    expect(texts(tree)).toContain("Amanda");
    expectFaceOf(tree, "amanda");
    expect(session?.companionId).toBe("amanda");
  });

  it("resolves the overlay person from the session even without route params", async () => {
    const tree = await mountControlSyncFor("chad", "Chad");
    press(byTestId(tree, "control-sync-minimize"));
    await settle();

    mockNavigation = fakeNavigation();
    mockRoute = { name: LOVE_SYNC };
    await show(tree, <LoveSyncScreen />);

    expect(texts(tree)).toContain("Chad");
    expectFaceOf(tree, "chad");
  });
});

describe("Love and Message Sync overlays show their own person", () => {
  it.each([
    { surface: "message" as const, name: "Amanda", companionId: "amanda" },
    { surface: "love" as const, name: "Chad", companionId: "chad" },
  ])(
    "$surface-origin Sync with $name shows that face, not Kevin's",
    async ({ surface, name, companionId }) => {
      mockNavigation = fakeNavigation();
      mockRoute = { name: LOVE_SYNC, params: { companionId, name } };
      const tree = await mount(
        <SeedSession companionId={companionId} name={name} surface={surface} />
      );
      await show(tree, <LoveSyncScreen />);

      expect(session?.companionId).toBe(companionId);
      expect(texts(tree)).toContain(name);
      expectFaceOf(tree, companionId);
    }
  );

  it("shows a created companion's look on the Sync overlay", async () => {
    await persistCreatedCompanion(nova);
    mockNavigation = fakeNavigation();
    mockRoute = {
      name: LOVE_SYNC,
      params: { companionId: nova.id, name: nova.name },
    };
    const tree = await mount(
      <SeedSession companionId={nova.id} name={nova.name} surface="love" />
    );
    await show(tree, <LoveSyncScreen />);

    expect(texts(tree)).toContain("Nova");
    expect(tree.root.findAllByType(Svg).length).toBeGreaterThan(0);
    expectNoKevinPortrait(tree);
  });
});

describe("SyncStack opened with a person already bound", () => {
  it("hands both the name and the companion id to the Sync screen", async () => {
    // Dropping the id here made SyncScreen fall back to `sync-<name>`, whose
    // portrait lookup is Kevin's default.
    mockNavigation = fakeNavigation();
    mockRoute = {
      name: String(SCREENS.SYNC_STACK),
      params: { companionId: "amanda", name: "Amanda" },
    };
    const tree = await mount(<SyncStack />);

    const navigator = tree.root.findByType(StackNavigator);
    expect(navigator.props.initialRouteName).toBe(SYNC_SCREEN);

    const syncScreen = tree.root
      .findAllByType(StackScreen)
      .find((node) => node.props.name === SYNC_SCREEN);
    expect(syncScreen?.props.initialParams).toEqual({
      name: "Amanda",
      companionId: "amanda",
    });
  });

  it("opens the picker when the Control hub card passes no person", async () => {
    mockNavigation = fakeNavigation();
    mockRoute = { name: String(SCREENS.SYNC_STACK) };
    const tree = await mount(<SyncStack />);

    const navigator = tree.root.findByType(StackNavigator);
    expect(navigator.props.initialRouteName).toBe(
      String(SCREENS.SYNC_SELECTION_SCREEN)
    );
    const syncScreen = tree.root
      .findAllByType(StackScreen)
      .find((node) => node.props.name === SYNC_SCREEN);
    expect(syncScreen?.props.initialParams).toBeUndefined();
  });
});
