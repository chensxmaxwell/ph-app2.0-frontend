import React from "react";
import { Text, TextInput, TouchableOpacity } from "react-native";
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
import { writeSessionUser } from "../src/backend/session";
import {
  ARK_BASE_URL,
  ARK_MODEL,
  saveLlmConfig,
} from "../src/services/llm-config";
import { ChatProvider, useChat } from "../src/screens/chat/store";
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

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: { threadId: string } = { threadId: "kevin" };
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
  useIsFocused: () => true,
}));
jest.mock("../src/screens/love/pill", () => ({
  useOpenLove: () => jest.fn(),
}));

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

const trees: ReactTestRenderer[] = [];

const threadTree = () => (
  <ChatProvider>
    <Probe />
    <ChatThreadScreen />
  </ChatProvider>
);

const renderThread = async (threadId: string) => {
  mockRouteParams = { threadId };
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(threadTree());
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

const showThread = (tree: ReactTestRenderer, threadId: string) => {
  mockRouteParams = { threadId };
  act(() => tree.update(threadTree()));
};

// Composer row = waveform, input, plus, paperplane. The RN Jest preset wraps
// every View in a mock composite, so walk up to the first ancestor that holds
// all three composer buttons instead of counting levels.
const composerOf = (tree: ReactTestRenderer) => {
  const input = tree.root.findByType(TextInput);
  let composer: ReactTestInstance | null = input.parent;
  while (composer && composer.findAllByType(TouchableOpacity).length < 3) {
    composer = composer.parent;
  }
  if (!composer) {
    throw new Error("Composer row not found");
  }
  const buttons = composer.findAllByType(TouchableOpacity);
  return { input, send: buttons[buttons.length - 1] };
};

const textsOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat()
    .filter((child): child is string => typeof child === "string");

const buttonWithLabel = (
  tree: ReactTestRenderer,
  label: string
): ReactTestInstance => {
  const match = tree.root
    .findAllByType(TouchableOpacity)
    .find((button) =>
      button
        .findAllByType(Text)
        .some((text) => text.props.children === label)
    );
  if (!match) {
    throw new Error(`No button labelled ${label}`);
  }
  return match;
};

const arkReply = (content: string) =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
    json: async () => ({ choices: [{ message: { content } }] }),
  });

const originalFetch = global.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  global.fetch = jest.fn(() => arkReply("我在呢。")) as typeof fetch;
  api = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  global.fetch = originalFetch;
  jest.useRealTimers();
});

describe("Message thread send path", () => {
  it("sends from the real composer without throwing and clears the draft", async () => {
    await saveLlmConfig({
      apiKey: "ark-device-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });
    const tree = await renderThread("kevin");
    const { input, send } = composerOf(tree);

    act(() => input.props.onChangeText("你好 Kevin"));
    expect(input.props.value).toBe("你好 Kevin");

    act(() => send.props.onPress());
    await settle();

    const kevin = api!.getThread("kevin")!;
    const mine = kevin.messages.filter((item) => item.from === "me");
    expect(mine[mine.length - 1].text).toBe("你好 Kevin");
    expect(kevin.messages[kevin.messages.length - 1]).toMatchObject({
      from: "them",
      text: "我在呢。",
    });
    expect(composerOf(tree).input.props.value).toBe("");
    expect(textsOf(tree)).toContain("我在呢。");
  });

  it("defers the clear to onBlur while the iOS composer is first responder", async () => {
    const tree = await renderThread("kevin");
    const { input, send } = composerOf(tree);
    const native = input.instance as {
      isFocused: jest.Mock;
      blur: jest.Mock;
    };
    native.isFocused.mockReturnValue(true);

    act(() => input.props.onChangeText("still typing"));
    act(() => send.props.onPress());

    expect(native.blur).toHaveBeenCalled();
    expect(composerOf(tree).input.props.value).toBe("still typing");

    act(() => input.props.onBlur());
    expect(composerOf(tree).input.props.value).toBe("");
    await settle();
  });

  it("shows the Companion AI notice instead of throwing when no key is saved", async () => {
    const tree = await renderThread("kevin");
    const { input, send } = composerOf(tree);

    act(() => input.props.onChangeText("hello"));
    act(() => send.props.onPress());
    await settle();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(textsOf(tree).join("\n")).toMatch(/Companion AI/);
  });

  it("keeps sending after a rejected key and with Listen turned on", async () => {
    await saveLlmConfig({
      apiKey: "bad-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
        json: async () => ({}),
      })
    );
    const tree = await renderThread("kevin");
    act(() => api!.setListen("kevin", true));
    await settle();

    const { input, send } = composerOf(tree);
    act(() => input.props.onChangeText("are you there"));
    act(() => send.props.onPress());
    await settle();

    expect(textsOf(tree).join("\n")).toMatch(/refused|Companion AI/);
    expect(api!.getThread("kevin")!.messages.slice(-1)[0]).toMatchObject({
      from: "me",
      text: "are you there",
    });
  });
});

describe("friend request cancel path", () => {
  const zoe = {
    id: "zoe",
    name: "Zoe",
    email: "zoe@local",
    gender: "Female",
    birthday: "01/01/2000",
    plan: "Free user",
  };

  it("cancelFriendRequest removes the pending thread without a ReferenceError", async () => {
    await renderThread("kevin");
    act(() => {
      api!.sendFriendRequest(zoe);
    });
    expect(api!.getThread("zoe")).toMatchObject({ request: "sent" });

    expect(() => {
      act(() => api!.cancelFriendRequest("zoe"));
    }).not.toThrow();
    expect(api!.getThread("zoe")).toBeUndefined();
    await settle();
  });

  it("tapping Cancel request on a sent request does not throw", async () => {
    const tree = await renderThread("kevin");
    act(() => {
      api!.sendFriendRequest(zoe);
    });
    showThread(tree, "zoe");

    const cancel = buttonWithLabel(tree, "Cancel request");
    expect(() => {
      act(() => cancel.props.onPress());
    }).not.toThrow();
    expect(mockGoBack).toHaveBeenCalled();
    expect(api!.getThread("zoe")).toBeUndefined();
    await settle();
  });
});
