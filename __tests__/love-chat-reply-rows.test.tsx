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
import { CompanionsProvider } from "../src/store/companions";
import { ChatProvider } from "../src/screens/chat/store";
import { LoveChatScreen } from "../src/screens/love/chat";
import {
  LoveSessionProvider,
  useLoveSession,
} from "../src/screens/love/session";
import {
  clearLoveSessionBoot,
  prepareLoveSessionBoot,
} from "../src/screens/love/session-persist";

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
jest.mock("@react-navigation/native", () => ({
  CommonActions: { reset: (payload: unknown) => ({ type: "RESET", payload }) },
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  }),
  useRoute: () => ({ params: { companionId: "kevin", name: "Kevin" } }),
  useIsFocused: () => true,
}));
jest.mock("../src/screens/avatar/look-face", () => ({
  LookFace: () => null,
}));
jest.mock("../src/screens/love/pill", () => ({
  LovePill: () => null,
  useOpenLove: () => jest.fn(),
}));

type LoveApi = ReturnType<typeof useLoveSession>;

let love: LoveApi | null = null;
const Probe = () => {
  love = useLoveSession();
  return null;
};

const flush = async () => {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const settle = () => act(flush);

const trees: ReactTestRenderer[] = [];

const renderLoveChat = async () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CompanionsProvider>
        <LoveSessionProvider>
          <ChatProvider>
            <Probe />
            <LoveChatScreen />
          </ChatProvider>
        </LoveSessionProvider>
      </CompanionsProvider>
    );
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

// Love composer row = phone, input, plus, paperplane.
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

const regenerateRows = (tree: ReactTestRenderer) =>
  textsOf(tree).filter((text) => /regenerate/i.test(text));

const bubbles = () =>
  (love?.chat?.messages ?? []).filter(
    (item): item is Extract<typeof item, { kind: "bubble" }> =>
      item.kind === "bubble"
  );

const arkResponse = (content: string) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  json: async () => ({ choices: [{ message: { content } }] }),
});

const deferredArk = () => {
  let resolve!: (content: string) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<ReturnType<typeof arkResponse>>((res, rej) => {
    resolve = (content) => res(arkResponse(content));
    reject = rej;
  });
  return { promise, resolve, reject };
};

const originalFetch = global.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  clearLoveSessionBoot();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  await prepareLoveSessionBoot("demo");
  await saveLlmConfig({
    apiKey: "ark-device-key",
    baseUrl: ARK_BASE_URL,
    model: ARK_MODEL,
  });
  love = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  global.fetch = originalFetch;
});

describe("Love chat rows while Kevin's reply is in flight", () => {
  it("adds no assistant row and no Regenerate control until Ark answers", async () => {
    const ark = deferredArk();
    global.fetch = jest.fn(() => ark.promise) as unknown as typeof fetch;
    const tree = await renderLoveChat();

    expect(bubbles()).toHaveLength(1);
    expect(bubbles()[0].from).toBe("them");
    expect(regenerateRows(tree)).toHaveLength(0);

    const { input, send } = composerOf(tree);
    act(() => input.props.onChangeText("你好 Kevin"));
    act(() => send.props.onPress());
    await settle();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    // The user's bubble is the last row. No empty or placeholder companion
    // turn exists yet, and nothing offers Regenerate on the user bubble.
    const pending = bubbles();
    expect(pending).toHaveLength(2);
    expect(pending[pending.length - 1]).toMatchObject({
      from: "me",
      text: "你好 Kevin",
    });
    expect(pending.every((item) => item.text.trim().length > 0)).toBe(true);
    expect(regenerateRows(tree)).toHaveLength(0);

    await act(async () => {
      ark.resolve("我在呢。");
      await flush();
    });

    const done = bubbles();
    expect(done).toHaveLength(3);
    expect(done[done.length - 1]).toMatchObject({
      from: "them",
      text: "我在呢。",
    });
    expect(textsOf(tree)).toContain("我在呢。");
  });

  it("leaves the user bubble last with a notice, and no Regenerate, when Ark fails", async () => {
    const ark = deferredArk();
    global.fetch = jest.fn(() => ark.promise) as unknown as typeof fetch;
    const tree = await renderLoveChat();

    const { input, send } = composerOf(tree);
    act(() => input.props.onChangeText("are you there"));
    act(() => send.props.onPress());
    await settle();

    await act(async () => {
      ark.reject(new TypeError("Network request failed"));
      await flush();
    });

    const after = bubbles();
    expect(after[after.length - 1]).toMatchObject({
      from: "me",
      text: "are you there",
    });
    expect(textsOf(tree).join("\n")).toMatch(/Companion AI/);
    expect(regenerateRows(tree)).toHaveLength(0);
  });
});
