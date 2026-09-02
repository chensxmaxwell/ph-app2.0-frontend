import React, { ReactNode } from "react";
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
import { CompanionsProvider } from "../src/store/companions";
import { ChatProvider } from "../src/screens/chat/store";
import {
  LoveSessionProvider,
  useLoveSession,
} from "../src/screens/love/session";
import {
  clearLoveSessionBoot,
  prepareLoveSessionBoot,
  saveLoveSessionForUser,
} from "../src/screens/love/session-persist";
import {
  parsePersistedLoveSession,
  showsSessionLovePill,
} from "../src/screens/love/session-logic";
import { bindHomeStackNavigation } from "../src/screens/love/overlay";
import { SessionLovePill } from "../src/screens/love/pill";
import { LoveSyncScreen } from "../src/screens/love/sync";
import SyncScreen from "../src/screens/sync/sync_screen";

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

type FakeRoute = { key: string; name: string; params?: object };
type FakeNavigation = {
  dispatch: (action: unknown) => void;
  goBack: () => void;
  navigate: (name: string, params?: object) => void;
  getParent: () => FakeNavigation | undefined;
  setOptions: () => void;
  addListener: () => () => void;
};

let mockNavigation: FakeNavigation;
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

const NAV_BAR = String(SCREENS.NAV_BAR);
const SYNC_STACK = String(SCREENS.SYNC_STACK);
const LOVE_CHAT = String(SCREENS.LOVE_CHAT);
const LOVE_SYNC = String(SCREENS.LOVE_SYNC);

// Minimal Home-stack model: enough of React Navigation's reducer for the
// functional `dispatch((state) => action)` resets in overlay.ts plus goBack /
// navigate, while recording every intermediate stack so a LoveChat that is only
// present for a frame (the reported flash) still shows up in `history`.
const createHomeStack = (initial: { name: string; params?: object }[]) => {
  let seq = 0;
  const keyed = (route: { name: string; params?: object; key?: string }) =>
    route.key
      ? (route as FakeRoute)
      : { ...route, key: `${route.name}-${(seq += 1)}` };
  const routes: FakeRoute[] = initial.map(keyed);
  const history: string[][] = [routes.map((route) => route.name)];
  const record = () => history.push(routes.map((route) => route.name));
  const apply = (action: unknown) => {
    const typed = action as {
      type?: string;
      payload?: { routes?: FakeRoute[]; name?: string; params?: object };
    };
    switch (typed?.type) {
      case "RESET": {
        const next = (typed.payload?.routes ?? []).map(keyed);
        routes.splice(0, routes.length, ...next);
        break;
      }
      case "GO_BACK":
        routes.pop();
        break;
      case "NAVIGATE":
        routes.push(
          keyed({
            name: typed.payload?.name ?? "",
            params: typed.payload?.params,
          })
        );
        break;
      default:
        break;
    }
    record();
  };
  const navigation: FakeNavigation = {
    dispatch: jest.fn((action: unknown) =>
      apply(
        typeof action === "function"
          ? action({ index: routes.length - 1, routes: [...routes] })
          : action
      )
    ),
    goBack: jest.fn(() => apply({ type: "GO_BACK" })),
    navigate: jest.fn((name: string, params?: object) =>
      apply({ type: "NAVIGATE", payload: { name, params } })
    ),
    getParent: () => undefined,
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => undefined),
  };
  return {
    routes,
    history,
    navigation,
    names: () => routes.map((route) => route.name),
    top: () => routes[routes.length - 1],
  };
};

// SyncScreen lives inside the nested SyncStack navigator; its `getParent()` is
// the Home stack that owns the SyncStack route.
const nestedSyncStackNavigation = (parent: FakeNavigation): FakeNavigation => ({
  dispatch: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  getParent: () => parent,
  setOptions: jest.fn(),
  addListener: jest.fn(() => () => undefined),
});

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

const pill = (tree: ReactTestRenderer) => {
  const buttons = tree.root.findAllByType(TouchableOpacity);
  if (buttons.length !== 1) {
    throw new Error(
      `Expected exactly one pill button, found ${buttons.length}`
    );
  }
  return buttons[0];
};

const kevin = { companionId: "kevin", name: "Kevin" };

beforeEach(async () => {
  await AsyncStorage.clear();
  clearLoveSessionBoot();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  session = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
});

describe("Control hub Sync: minimize, pill restore, red X", () => {
  it("restores straight into Sync and hangs up back onto the Control hub, never a dark Love chat", async () => {
    // Control hub → Sync card → SyncStack (picker → SyncScreen for Kevin).
    const home = createHomeStack([{ name: NAV_BAR }, { name: SYNC_STACK }]);
    const hubKey = home.routes[0].key;
    bindHomeStackNavigation(home.navigation as never);

    mockNavigation = nestedSyncStackNavigation(home.navigation);
    mockRoute = { name: String(SCREENS.SYNC_SCREEN), params: kevin };
    const tree = await mount(<SyncScreen />);

    // Minimize: keep the session + pill, pop the picker stack, land on the hub.
    press(byTestId(tree, "control-sync-minimize"));
    await settle();
    expect(home.names()).toEqual([NAV_BAR]);
    expect(session).toMatchObject({
      layer: "sync",
      minimized: true,
      companionId: "kevin",
    });
    const recordedSurface = session?.surface;

    // Global pill on the hub → restore. Reported: dark chat flashes, then Sync.
    mockNavigation = home.navigation;
    mockRoute = { name: NAV_BAR };
    await show(tree, <SessionLovePill />);
    press(pill(tree));
    await settle();

    expect(home.names()).toEqual([NAV_BAR, LOVE_SYNC]);
    expect(home.routes[0].key).toBe(hubKey);
    expect(session?.minimized).toBe(false);
    expect(session?.layer).toBe("sync");

    // Red X on the restored Sync overlay. Reported: lands on that dark chat.
    mockRoute = { name: LOVE_SYNC, params: home.top().params };
    await show(tree, <LoveSyncScreen />);
    press(byTestId(tree, "love-sync-hangup"));
    await settle();
    await show(tree, null);

    expect(home.top().name).not.toBe(LOVE_CHAT);
    expect(home.names()).toEqual([NAV_BAR]);
    expect(home.routes[0].key).toBe(hubKey);
    expect(session?.layer).toBeNull();
    expect(session?.companionId).toBeUndefined();
    expect(session?.minimized).toBe(false);

    // The dark chat was never on the stack, not even for a frame.
    expect(home.history.flat()).not.toContain(LOVE_CHAT);
    // The session remembered it started on the Control hub, not in Love chat.
    expect(recordedSurface).toBe("control");
  });

  it("does not leave a phantom Love chat session behind after hang-up", async () => {
    const home = createHomeStack([{ name: NAV_BAR }, { name: SYNC_STACK }]);
    bindHomeStackNavigation(home.navigation as never);

    mockNavigation = nestedSyncStackNavigation(home.navigation);
    mockRoute = { name: String(SCREENS.SYNC_SCREEN), params: kevin };
    const tree = await mount(<SyncScreen />);
    press(byTestId(tree, "control-sync-minimize"));
    await settle();

    mockNavigation = home.navigation;
    mockRoute = { name: NAV_BAR };
    await show(tree, <SessionLovePill />);
    press(pill(tree));
    await settle();

    mockRoute = { name: LOVE_SYNC, params: home.top().params };
    await show(tree, <LoveSyncScreen />);
    press(byTestId(tree, "love-sync-hangup"));
    await settle();
    await show(tree, null);

    expect(session?.layer).toBeNull();
    expect(session?.chat).toBeNull();
    expect(session?.syncStartedAt).toBeNull();
    // A hidden "chat" layer here would resurface as a pill on the next launch.
    await show(tree, <SessionLovePill />);
    expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  });

  it("keeps the Control origin across a process kill so the relaunch pill does not rebuild Love chat", async () => {
    await saveLoveSessionForUser("demo", {
      companionId: "kevin",
      layer: "sync",
      minimized: true,
      surface: "control",
      chat: {
        companionId: "kevin",
        name: "Kevin",
        messages: [{ kind: "sync", id: "s1" }],
        synced: true,
        inCall: false,
        listen: false,
        pinned: true,
        mode: "none",
      },
      callStartedAt: null,
      syncStartedAt: 1700000000000,
    });
    expect(
      parsePersistedLoveSession({ layer: "sync", surface: "control" })?.surface
    ).toBe("control");

    clearLoveSessionBoot();
    const boot = await prepareLoveSessionBoot("demo");
    expect(showsSessionLovePill(boot.live)).toBe(true);
    expect(boot.live.surface).toBe("control");

    // Relaunch lands on NavBar (Home tab); the pill is the only way back in.
    const home = createHomeStack([{ name: NAV_BAR }]);
    bindHomeStackNavigation(home.navigation as never);
    mockNavigation = home.navigation;
    mockRoute = { name: NAV_BAR };
    const tree = await mount(<SessionLovePill />);
    press(pill(tree));
    await settle();

    expect(home.names()).toEqual([NAV_BAR, LOVE_SYNC]);
    expect(home.history.flat()).not.toContain(LOVE_CHAT);
    expect(home.history.flat()).not.toContain(String(SCREENS.CHAT_THREAD));

    mockRoute = { name: LOVE_SYNC, params: home.top().params };
    await show(tree, <LoveSyncScreen />);
    press(byTestId(tree, "love-sync-hangup"));
    await settle();
    await show(tree, null);

    expect(home.names()).toEqual([NAV_BAR]);
    expect(session?.layer).toBeNull();
    expect(home.history.flat()).not.toContain(LOVE_CHAT);
  });

  it("still returns a Love-origin Sync to its Love chat on red X", async () => {
    // Love chat → + → Sync keeps LoveChat under LoveSync; X must go back there.
    const home = createHomeStack([
      { name: NAV_BAR },
      { name: LOVE_CHAT, params: kevin },
      { name: LOVE_SYNC, params: kevin },
    ]);
    bindHomeStackNavigation(home.navigation as never);
    mockNavigation = home.navigation;
    mockRoute = { name: LOVE_SYNC, params: kevin };

    const Seed = () => {
      const { start } = useLoveSession();
      React.useEffect(() => {
        start({ layer: "sync", surface: "love", ...kevin });
      }, [start]);
      return null;
    };
    const tree = await mount(<Seed />);
    await show(tree, <LoveSyncScreen />);
    expect(session?.surface).toBe("love");

    press(byTestId(tree, "love-sync-hangup"));
    await settle();

    expect(home.names()).toEqual([NAV_BAR, LOVE_CHAT]);
    expect(session?.layer).toBe("chat");
    expect(session?.companionId).toBe("kevin");
  });
});
