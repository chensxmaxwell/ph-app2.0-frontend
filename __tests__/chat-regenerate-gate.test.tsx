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
import { regenerateTargetId } from "../src/screens/chat/regenerate";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import { ChatThreadScreen } from "../src/screens/chat/thread";
import { ChatBubble } from "../src/screens/chat/types";

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

// Composer row = waveform, input, plus, paperplane. Walk up from the input to
// the first ancestor that holds all three buttons (the RN Jest preset wraps
// every View in a mock composite, so counting levels is brittle).
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

const regenerateButtons = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .filter((button) =>
      button
        .findAllByType(Text)
        .some((text) => text.props.children === "Regenerate")
    );

const textsOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat()
    .filter((child): child is string => typeof child === "string");

const sendFromComposer = async (tree: ReactTestRenderer, text: string) => {
  const { input, send } = composerOf(tree);
  act(() => input.props.onChangeText(text));
  act(() => send.props.onPress());
  await settle();
};

const arkResponse = (content: string) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  json: async () => ({ choices: [{ message: { content } }] }),
});

// One Ark round trip the test controls: fetch stays pending until the test
// resolves (or rejects) it, which is the window the bug lived in.
const deferredArk = () => {
  let resolve!: (content: string) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<ReturnType<typeof arkResponse>>((res, rej) => {
    resolve = (content) => res(arkResponse(content));
    reject = rej;
  });
  return { promise, resolve, reject };
};

const withArkKey = () =>
  saveLlmConfig({
    apiKey: "ark-device-key",
    baseUrl: ARK_BASE_URL,
    model: ARK_MODEL,
  });

const originalFetch = global.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  global.fetch = jest.fn(() =>
    Promise.resolve(arkResponse("我在呢。"))
  ) as unknown as typeof fetch;
  api = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  global.fetch = originalFetch;
});

describe("regenerateTargetId (which row may carry Regenerate)", () => {
  const me = (id: string, text = "hi"): ChatBubble => ({
    id,
    from: "me",
    text,
  });
  const them = (id: string, text = "hey"): ChatBubble => ({
    id,
    from: "them",
    text,
  });

  it("points at the final bubble when it is a finished bot reply to the user", () => {
    expect(regenerateTargetId([them("k1"), me("k2"), them("k3")], false)).toBe(
      "k3"
    );
  });

  it("returns null while a reply is still in flight, even if a bot line is last", () => {
    expect(regenerateTargetId([them("k1"), me("k2"), them("k3")], true)).toBe(
      null
    );
  });

  it("returns null when the user bubble is last (reply pending or failed)", () => {
    expect(regenerateTargetId([them("k1"), me("k2")], false)).toBeNull();
    expect(regenerateTargetId([them("k1"), me("k2")], true)).toBeNull();
  });

  it("never picks an earlier bot bubble over a trailing user bubble", () => {
    // This is the exact shape that used to show Regenerate: lastThem existed
    // (k3) but the newest row was the user's still-unanswered message.
    expect(
      regenerateTargetId([them("k1"), me("k2"), them("k3"), me("k4")], false)
    ).toBeNull();
  });

  it("returns null for an empty thread, an empty assistant turn, or a voice row", () => {
    expect(regenerateTargetId([], false)).toBeNull();
    expect(regenerateTargetId([me("k1"), them("k2", "")], false)).toBeNull();
    expect(regenerateTargetId([me("k1"), them("k2", "   ")], false)).toBeNull();
    expect(
      regenerateTargetId(
        [me("k1"), { id: "k2", from: "them", text: "voice", voice: true }],
        false
      )
    ).toBeNull();
  });

  it("returns null for a greeting with no user message to regenerate from", () => {
    expect(regenerateTargetId([them("k1")], false)).toBeNull();
    expect(regenerateTargetId([them("k1"), them("k2")], false)).toBeNull();
  });
});

describe("Regenerate only on a finished companion reply (Message thread)", () => {
  it("hides Regenerate while Kevin's Ark reply is still in flight, then shows it on the reply", async () => {
    await withArkKey();
    const ark = deferredArk();
    (global.fetch as jest.Mock).mockImplementation(() => ark.promise);
    const tree = await renderThread("kevin");

    // Seed thread ends on a finished Kevin line, so Regenerate is legitimate.
    expect(regenerateButtons(tree)).toHaveLength(1);

    await sendFromComposer(tree, "你好 Kevin");

    const kevin = api!.getThread("kevin")!;
    expect(kevin.messages[kevin.messages.length - 1]).toMatchObject({
      from: "me",
      text: "你好 Kevin",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // The bug: the user bubble is the last row, Ark has not answered, and the
    // Regenerate row was already on screen under the user's own message.
    expect(regenerateButtons(tree)).toHaveLength(0);
    expect(api!.replyPending("kevin")).toBe(true);

    await act(async () => {
      ark.resolve("我在呢。");
      await flush();
    });

    expect(textsOf(tree)).toContain("我在呢。");
    expect(api!.replyPending("kevin")).toBe(false);
    const buttons = regenerateButtons(tree);
    expect(buttons).toHaveLength(1);
    const reply = api!.getThread("kevin")!.messages.slice(-1)[0];
    expect(reply).toMatchObject({ from: "them", text: "我在呢。" });
    expect(buttons[0].props.testID).toBe(`regenerate-${reply.id}`);
    // The control is the row right under that reply, not a list footer.
    const siblings = buttons[0].parent!.children;
    const previous = siblings[siblings.indexOf(buttons[0]) - 1];
    expect(typeof previous).not.toBe("string");
    expect(
      (previous as ReactTestInstance)
        .findAllByType(Text)
        .map((text) => text.props.children)
    ).toContain("我在呢。");
  });

  it("hides Regenerate while a draft is being typed and restores it when the draft clears", async () => {
    const tree = await renderThread("kevin");
    expect(regenerateButtons(tree)).toHaveLength(1);

    const { input } = composerOf(tree);
    act(() => input.props.onChangeText("typing…"));
    expect(regenerateButtons(tree)).toHaveLength(0);

    act(() => input.props.onChangeText(""));
    expect(regenerateButtons(tree)).toHaveLength(1);
  });

  it("keeps Regenerate hidden when the reply fails and the user bubble stays last", async () => {
    await withArkKey();
    const ark = deferredArk();
    (global.fetch as jest.Mock).mockImplementation(() => ark.promise);
    const tree = await renderThread("kevin");

    await sendFromComposer(tree, "are you there");
    expect(regenerateButtons(tree)).toHaveLength(0);

    await act(async () => {
      ark.reject(new TypeError("Network request failed"));
      await flush();
    });

    expect(api!.replyPending("kevin")).toBe(false);
    expect(textsOf(tree).join("\n")).toMatch(/Companion AI/);
    expect(api!.getThread("kevin")!.messages.slice(-1)[0]).toMatchObject({
      from: "me",
      text: "are you there",
    });
    expect(regenerateButtons(tree)).toHaveLength(0);
  });

  it("does not show Regenerate on the user bubble when no key is saved", async () => {
    const tree = await renderThread("kevin");

    await sendFromComposer(tree, "hello");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(textsOf(tree).join("\n")).toMatch(/Companion AI/);
    expect(regenerateButtons(tree)).toHaveLength(0);
  });

  it("hides Regenerate while a regenerate request is in flight and ignores a second tap", async () => {
    await withArkKey();
    const ark = deferredArk();
    (global.fetch as jest.Mock).mockImplementation(() => ark.promise);
    const tree = await renderThread("kevin");
    const before = api!.getThread("kevin")!;
    const oldReply = before.messages[before.messages.length - 1];
    expect(oldReply.from).toBe("them");

    act(() => regenerateButtons(tree)[0].props.onPress());
    await settle();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(api!.replyPending("kevin")).toBe(true);
    expect(regenerateButtons(tree)).toHaveLength(0);
    // The old text stays on screen until the new one lands.
    expect(textsOf(tree)).toContain(oldReply.text);

    // A stale tap (same frame, double tap) must not start a second request.
    act(() => api!.regenerate("kevin"));
    await settle();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      ark.resolve("换个说法：我一直在。");
      await flush();
    });

    const after = api!.getThread("kevin")!;
    expect(after.messages).toHaveLength(before.messages.length);
    expect(after.messages[after.messages.length - 1]).toMatchObject({
      id: oldReply.id,
      from: "them",
      text: "换个说法：我一直在。",
    });
    expect(api!.replyPending("kevin")).toBe(false);
    const buttons = regenerateButtons(tree);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.testID).toBe(`regenerate-${oldReply.id}`);
  });

  it("does not offer Regenerate on a greeting-only bot thread (nothing to regenerate from)", async () => {
    const tree = await renderThread("kevin");
    let id = "";
    act(() => {
      id = api!.createBot({
        name: "Nova",
        gender: "Female",
        birthday: "01/01/2000",
        description: "Nova is calm.",
      });
    });
    showThread(tree, id);
    await settle();

    const nova = api!.getThread(id)!;
    expect(nova.messages).toHaveLength(1);
    expect(nova.messages[0].from).toBe("them");
    expect(regenerateButtons(tree)).toHaveLength(0);

    // Tapping through the store is a no-op too: no user message to answer.
    act(() => api!.regenerate(id));
    await settle();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("never shows Regenerate in a human thread", async () => {
    const tree = await renderThread("kevin");
    act(() => {
      api!.sendFriendRequest({
        id: "zoe",
        name: "Zoe",
        email: "zoe@local",
        gender: "Female",
        birthday: "01/01/2000",
        plan: "Free user",
      });
    });
    act(() => api!.setRequest("zoe", "accepted"));
    showThread(tree, "zoe");
    await settle();

    expect(api!.getThread("zoe")!.messages.slice(-1)[0].from).toBe("them");
    expect(regenerateButtons(tree)).toHaveLength(0);
  });
});
