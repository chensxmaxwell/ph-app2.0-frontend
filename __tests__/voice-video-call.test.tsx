import React, { ReactNode } from "react";
import { Image, StyleSheet, Text, TouchableOpacity } from "react-native";
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
import { readFileSync } from "fs";
import { join } from "path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCREENS } from "../src/common/constant";
import { writeSessionUser } from "../src/backend/session";
import { saveCompanions } from "../src/backend/store";
import {
  ARK_BASE_URL,
  ARK_MODEL,
  saveLlmConfig,
} from "../src/services/llm-config";
import { configureTtsEngine } from "../src/services/tts";
import { startVoiceInput, stopVoiceInput } from "../src/services/voice-input";
import {
  Companion,
  CompanionsProvider,
  lookFromCompanion,
} from "../src/store/companions";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import { faceSourceForId } from "../src/screens/chat/faces";
import {
  LoveSessionProvider,
  useLoveSession,
} from "../src/screens/love/session";
import { clearLoveSessionBoot } from "../src/screens/love/session-persist";
import { ChatCallScreen } from "../src/screens/chat/call";
import { LoveCallScreen } from "../src/screens/love/call";
import { AvatarPreview } from "../src/screens/avatar/engine/AvatarPreview";
import { useAvatarEngine } from "../src/screens/avatar/engine/AvatarEngineHost";
import { InlineAvatarViewer } from "../src/screens/avatar/engine/InlineAvatarViewer";
import { DEFAULT_DRAFT } from "../src/screens/avatar/context";
import { CALL_CONNECT_DELAY_MS } from "../src/screens/call/use-voice-call";
import { callStatusLabel, holdButtonLabel } from "../src/screens/call/status";

/**
 * The phone icon on a Message thread and on Love chat used to open a timer
 * and a face with no audio behind it. These tests drive the real call
 * screens inside the app's providers with the speech, Ark and TTS edges
 * mocked, and check the loop: hold → recognized text → Ark reply → spoken,
 * plus the video stage, the missing-key copy and hang-up.
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
  nativeSpeak: jest.fn(),
  nativeStopSpeaking: jest.fn(),
  nativeStartVoiceInput: jest.fn(),
  nativeStopVoiceInput: jest.fn(),
}));
// iOS Speech framework through PHNative: hold starts it, release returns the
// transcript. Mocked at the service edge so the loop above it is real.
jest.mock("../src/services/voice-input", () => ({
  startVoiceInput: jest.fn(),
  stopVoiceInput: jest.fn(),
  speakWithNativeTts: jest.fn(),
  stopNativeTts: jest.fn(),
}));
let mockCameraAvailable = true;
jest.mock("../src/native/camera-preview", () => {
  const ReactModule = require("react");
  const Native = (props: object) =>
    ReactModule.createElement("PHCameraPreview", props);
  return {
    CAMERA_PREVIEW_VIEW: "PHCameraPreview",
    cameraPreviewAvailable: () => mockCameraAvailable,
    nativeCameraPreview: () => (mockCameraAvailable ? Native : null),
  };
});

type FakeNavigation = {
  dispatch: jest.Mock;
  goBack: jest.Mock;
  navigate: jest.Mock;
  canGoBack: () => boolean;
  getParent: () => FakeNavigation | undefined;
  setOptions: jest.Mock;
  addListener: jest.Mock;
};

const fakeNavigation = (): FakeNavigation => ({
  dispatch: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  canGoBack: () => true,
  getParent: () => undefined,
  setOptions: jest.fn(),
  addListener: jest.fn(() => () => undefined),
});

let mockNavigation: FakeNavigation = fakeNavigation();
let mockRoute: { name: string; params?: object } = {
  name: String(SCREENS.CHAT_CALL),
  params: { threadId: "kevin" },
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

const startVoice = startVoiceInput as jest.Mock<typeof startVoiceInput>;
const stopVoice = stopVoiceInput as jest.Mock<typeof stopVoiceInput>;

type ChatApi = ReturnType<typeof useChat>;
type SessionApi = ReturnType<typeof useLoveSession>;
type EngineApi = ReturnType<typeof useAvatarEngine>;
let chat: ChatApi | null = null;
let session: SessionApi | null = null;
let engine: EngineApi | null = null;
const Probe = () => {
  chat = useChat();
  session = useLoveSession();
  engine = useAvatarEngine();
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
  for (let index = 0; index < 8; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};
const settle = () => act(flush);
// The call rings for CALL_CONNECT_DELAY_MS before it reads as connected.
const connect = async () => {
  act(() => {
    jest.advanceTimersByTime(CALL_CONNECT_DELAY_MS + 100);
  });
  await settle();
};

const trees: ReactTestRenderer[] = [];

// The stores hydrate at app launch, long before anyone taps the phone icon:
// mount the providers first, let them settle, then push the call overlay.
const mountCall = async (screen: ReactNode) => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Providers>{null}</Providers>);
  });
  trees.push(tree!);
  await settle();
  act(() => {
    tree.update(<Providers>{screen}</Providers>);
  });
  await settle();
  return tree!;
};

const mountMessageCall = async (threadId: string) => {
  mockNavigation = fakeNavigation();
  mockRoute = { name: String(SCREENS.CHAT_CALL), params: { threadId } };
  return mountCall(<ChatCallScreen />);
};

const mountLoveCall = async (companionId: string, name: string) => {
  mockNavigation = fakeNavigation();
  mockRoute = {
    name: String(SCREENS.LOVE_CALL),
    params: { companionId, name },
  };
  return mountCall(<LoveCallScreen />);
};

const texts = (root: ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map((node) => React.Children.toArray(node.props.children).join(""));

const touchable = (root: ReactTestInstance, testID: string) => {
  const match = root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.testID === testID);
  if (!match) {
    throw new Error(`No TouchableOpacity with testID ${testID}`);
  }
  return match;
};

// The hold-to-talk control is a Pressable (press in / press out).
const holdButton = (root: ReactTestInstance) => {
  const match = root.findAll(
    (node) =>
      node.props?.testID === "call-hold" &&
      typeof node.props.onPressIn === "function"
  )[0];
  if (!match) {
    throw new Error("No hold-to-talk control (testID call-hold)");
  }
  return match;
};

const press = (node: ReactTestInstance) => {
  act(() => {
    node.props.onPress();
  });
};

const holdAndRelease = async (root: ReactTestInstance) => {
  const hold = holdButton(root);
  act(() => {
    hold.props.onPressIn();
  });
  await settle();
  act(() => {
    holdButton(root).props.onPressOut();
  });
  await settle();
};

const uriOf = (source: unknown) =>
  (source as { testUri?: string } | undefined)?.testUri ?? String(source);

const imageUris = (root: ReactTestInstance) =>
  root.findAllByType(Image).map((image) => uriOf(image.props.source));

// Every bundled portrait of Kevin (`message/kevin-photo.png` is Chad's).
const isKevinPhoto = (uri: string) =>
  /(^|\/)message\/kevin\.png$/.test(uri) ||
  /(^|\/)love\/call-face\.png$/.test(uri) ||
  /(^|\/)avatar-ring\.png$/.test(uri);

const stageFace = (root: ReactTestInstance) => {
  const match = root.findAll((node) => node.props?.testID === "call-stage-face")[0];
  if (!match) {
    throw new Error("No call stage face (testID call-stage-face)");
  }
  return match;
};

const cameraHosts = (root: ReactTestInstance) =>
  root.findAll((node) => String(node.type) === "PHCameraPreview");

const webViews = (root: ReactTestInstance) =>
  root.findAll((node) => String(node.type) === "MockWebView");

const arkReply = (content: string) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  json: async () => ({ choices: [{ message: { content } }] }),
});

type ArkBody = {
  model: string;
  messages: { role: string; content: string }[];
};

const arkBodies = () =>
  (global.fetch as jest.Mock).mock.calls.map(
    (call) => JSON.parse((call[1] as { body: string }).body) as ArkBody
  );

const saveArkKey = () =>
  saveLlmConfig({
    apiKey: "ark-device-key",
    baseUrl: ARK_BASE_URL,
    model: ARK_MODEL,
  });

const nova: Companion = {
  ...DEFAULT_DRAFT,
  id: "companion-nova",
  name: "Nova",
  birthday: "01/01/2000",
  gender: "Male",
  personalities: ["Playful & whimsical"],
  story: "Made in the avatar wizard.",
};

const originalFetch = global.fetch;
let speakMock: jest.Mock;
let ttsStopMock: jest.Mock;
let finishSpeaking: (() => void) | null = null;

beforeEach(async () => {
  jest.useFakeTimers({
    doNotFake: ["setImmediate", "nextTick", "queueMicrotask"],
  });
  await AsyncStorage.clear();
  clearLoveSessionBoot();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  chat = null;
  session = null;
  engine = null;
  mockCameraAvailable = true;
  startVoice.mockReset();
  stopVoice.mockReset();
  startVoice.mockResolvedValue({ ok: true, text: "" });
  stopVoice.mockResolvedValue({ ok: true, text: "你好 Kevin" });
  global.fetch = jest.fn(() =>
    Promise.resolve(arkReply("我在呢。"))
  ) as unknown as typeof fetch;
  finishSpeaking = null;
  // The device voice: speak() resolves when the utterance finishes.
  speakMock = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finishSpeaking = resolve;
      })
  );
  ttsStopMock = jest.fn(async () => {
    finishSpeaking?.();
    finishSpeaking = null;
  });
  configureTtsEngine({
    speak: speakMock as unknown as (input: { text: string }) => Promise<void>,
    stop: ttsStopMock as unknown as () => Promise<void>,
  });
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  global.fetch = originalFetch;
  configureTtsEngine({
    speak: async () => undefined,
    stop: async () => undefined,
  });
  jest.useRealTimers();
});

describe("Message thread voice call", () => {
  it("starts without an Ark key: shows the Companion AI settings copy and does not crash", async () => {
    const tree = await mountMessageCall("kevin");
    await connect();

    expect(chat!.inCallThreadId).toBe("kevin");
    const copy = texts(tree.root).join("\n");
    expect(copy).toMatch(/Companion AI/);
    expect(copy).toMatch(/Add a key/);
    expect(global.fetch).not.toHaveBeenCalled();
    // The call is still a call: connected, timer running, hang-up available.
    expect(texts(tree.root)).toContain("Connected");
    expect(() => touchable(tree.root, "call-hangup")).not.toThrow();
  });

  it("a held turn: recognized speech goes to Ark as Kevin and the reply is spoken while the face shows speaking", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connect();
    expect(texts(tree.root)).toContain("Connected");

    const hold = holdButton(tree.root);
    act(() => {
      hold.props.onPressIn();
    });
    await settle();
    expect(startVoice).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Listening…");
    expect(texts(tree.root)).toContain("Release to send");

    act(() => {
      holdButton(tree.root).props.onPressOut();
    });
    await settle();

    expect(stopVoice).toHaveBeenCalledTimes(1);
    const [body] = arkBodies();
    expect(body.model).toBe(ARK_MODEL);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("You are Kevin");
    expect(body.messages[body.messages.length - 1]).toEqual({
      role: "user",
      content: "你好 Kevin",
    });
    // Kevin's seeded thread history rides along as context.
    expect(body.messages.length).toBeGreaterThan(2);

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({ text: "我在呢。" });
    const copy = texts(tree.root);
    expect(copy).toContain("Kevin is speaking");
    expect(copy).toContain("你好 Kevin");
    expect(copy).toContain("我在呢。");
    // The spoken turn lands in the thread as a transcript.
    const kevin = chat!.getThread("kevin")!;
    expect(kevin.messages.slice(-2).map((m) => [m.from, m.text])).toEqual([
      ["me", "你好 Kevin"],
      ["them", "我在呢。"],
    ]);

    act(() => {
      finishSpeaking?.();
    });
    await settle();
    expect(texts(tree.root)).toContain("Connected");
    expect(texts(tree.root)).toContain("Hold to talk");
  });

  it("a release with nothing recognized asks to try again instead of calling Ark", async () => {
    await saveArkKey();
    stopVoice.mockResolvedValue({ ok: true, text: "   " });
    const tree = await mountMessageCall("kevin");
    await connect();

    await holdAndRelease(tree.root);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
    expect(texts(tree.root).join("\n")).toMatch(/Didn't catch that/);
  });

  it("a denied microphone shows the permission copy and stays on the call", async () => {
    await saveArkKey();
    startVoice.mockResolvedValue({
      ok: false,
      reason: "permission-denied",
      message: "Microphone access is needed to use voice input.",
    });
    const tree = await mountMessageCall("kevin");
    await connect();

    const hold = holdButton(tree.root);
    act(() => {
      hold.props.onPressIn();
    });
    await settle();

    expect(texts(tree.root)).toContain(
      "Microphone access is needed to use voice input."
    );
    expect(texts(tree.root)).toContain("Connected");
    expect(chat!.inCallThreadId).toBe("kevin");
  });

  it("switching video on and off keeps the conversation and shows Amanda, not Kevin's stock face", async () => {
    await saveArkKey();
    stopVoice.mockResolvedValue({ ok: true, text: "Hi Amanda" });
    const tree = await mountMessageCall("amanda");
    await connect();
    await holdAndRelease(tree.root);
    expect(texts(tree.root)).toContain("Amanda is speaking");

    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    // Main stage: this person's portrait. PiP: the front camera.
    expect(imageUris(stageFace(tree.root))).toEqual([
      uriOf(faceSourceForId("amanda")),
    ]);
    expect(imageUris(tree.root).filter(isKevinPhoto)).toEqual([]);
    expect(cameraHosts(tree.root)).toHaveLength(1);
    expect(cameraHosts(tree.root)[0].props.position).toBe("front");
    // The loop did not restart or lose its captions.
    const copy = texts(tree.root);
    expect(copy).toContain("Amanda is speaking");
    expect(copy).toContain("Hi Amanda");
    expect(copy).toContain("我在呢。");
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    press(touchable(tree.root, "call-video-toggle"));
    await settle();
    expect(cameraHosts(tree.root)).toHaveLength(0);
    expect(texts(tree.root)).toContain("Hi Amanda");
    expect(texts(tree.root)).toContain("Amanda is speaking");
  });

  it("the portrait fills the video stage instead of drawing at the asset's own size", async () => {
    // TestFlight 1.2 (14): Amanda's photo (girl.png, 786×676) sat at the
    // stage's top-left at its intrinsic size — only hair, one eye and an ear
    // were inside the rounded stage. RN's Image keeps the require()d asset's
    // width/height unless the style sets its own, and absoluteFill does not.
    const tree = await mountMessageCall("amanda");
    await connect();
    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    const [portrait] = stageFace(tree.root).findAllByType(Image);
    const style = StyleSheet.flatten(portrait.props.style);
    expect(style.width).toBe("100%");
    expect(style.height).toBe("100%");
    expect(portrait.props.resizeMode).toBe("cover");
  });

  it("video mode draws a crafted companion's 3D look on the stage, never a stock portrait", async () => {
    // A Kevin crafted in the wizard folds onto the seeded thread (one id).
    await saveCompanions("demo", {
      companions: [{ ...nova, id: "kevin", name: "Kevin" }],
      activeCompanionId: null,
    });
    const tree = await mountMessageCall("kevin");
    await connect();

    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    const stage = stageFace(tree.root);
    const viewer = stage.findAllByType(InlineAvatarViewer);
    expect(viewer).toHaveLength(1);
    expect(viewer[0].props.look).toEqual(
      lookFromCompanion({ ...nova, id: "kevin", name: "Kevin" })
    );
    expect(viewer[0].props.viewMode).toBe("bust");
    // The call is a transparentModal, presented by UIKit above the RN root
    // view where AvatarEngineHost floats its WebView, so a floated 3D face
    // is invisible on a call: the stage hosts its own viewer WebView, inside
    // its rounded, clipped box, and attaches no slot to the floating engine.
    expect(webViews(stage)).toHaveLength(1);
    expect(tree.root.findAllByType(AvatarPreview)).toHaveLength(0);
    expect(engine?.slot ?? null).toBeNull();
    // The vector face stands in until the viewer reports ready.
    expect(stage.findAllByType(Svg).length).toBeGreaterThan(0);
    expect(imageUris(tree.root).filter(isKevinPhoto)).toEqual([]);
  });

  it("the stage viewer drops the vector stand-in once the page is ready and offers Retry on error", async () => {
    await saveCompanions("demo", {
      companions: [{ ...nova, id: "kevin", name: "Kevin" }],
      activeCompanionId: null,
    });
    const tree = await mountMessageCall("kevin");
    await connect();
    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    const stage = stageFace(tree.root);
    expect(stage.findAllByType(Svg).length).toBeGreaterThan(0);
    act(() => {
      webViews(stage)[0].props.onMessage({ nativeEvent: { data: "ready" } });
    });
    expect(stage.findAllByType(Svg)).toHaveLength(0);
    expect(texts(stage)).not.toContain("Retry");

    act(() => {
      webViews(stage)[0].props.onMessage({
        nativeEvent: { data: "error:WebGL is unavailable" },
      });
    });
    const copy = texts(stage).join("\n");
    expect(copy).toMatch(/Couldn’t load 3D preview/);
    expect(copy).toMatch(/WebGL is unavailable/);
    press(touchable(stage, "call-stage-retry"));
    expect(stage.findAllByType(Svg).length).toBeGreaterThan(0);
    expect(texts(stage)).not.toContain("Retry");
  });

  it("shows the camera permission copy when the front camera is denied", async () => {
    const tree = await mountMessageCall("chad");
    await connect();
    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    const [camera] = cameraHosts(tree.root);
    act(() => {
      camera.props.onStatusChange({
        nativeEvent: { status: "denied", message: "" },
      });
    });
    await settle();

    expect(texts(tree.root).join("\n")).toMatch(/Camera access/);
    expect(texts(tree.root)).toContain("Open Settings");
  });

  it("says the camera is unavailable on a build without the native preview", async () => {
    mockCameraAvailable = false;
    const tree = await mountMessageCall("chad");
    await connect();
    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    expect(cameraHosts(tree.root)).toHaveLength(0);
    expect(texts(tree.root).join("\n")).toMatch(/Camera .*isn't available/);
    // The companion still fills the stage.
    expect(imageUris(stageFace(tree.root))).toEqual([
      uriOf(faceSourceForId("chad")),
    ]);
  });

  it("hang-up stops the mic and the voice, clears in-call and leaves", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connect();
    await holdAndRelease(tree.root);
    expect(speakMock).toHaveBeenCalledTimes(1);

    // Start another hold so the mic is live at hang-up.
    act(() => {
      holdButton(tree.root).props.onPressIn();
    });
    await settle();
    stopVoice.mockClear();

    press(touchable(tree.root, "call-hangup"));
    await settle();

    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(ttsStopMock).toHaveBeenCalled();
    expect(chat!.inCallThreadId).toBeNull();
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("a reply that arrives after hang-up is not spoken", async () => {
    await saveArkKey();
    let deliver: ((value: unknown) => void) | null = null;
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        })
    );
    const tree = await mountMessageCall("kevin");
    await connect();
    await holdAndRelease(tree.root);
    expect(texts(tree.root)).toContain("Thinking…");

    press(touchable(tree.root, "call-hangup"));
    await settle();
    act(() => {
      deliver?.(arkReply("too late"));
    });
    await settle();

    expect(speakMock).not.toHaveBeenCalled();
    expect(chat!.inCallThreadId).toBeNull();
  });

  it("minimize leaves the Message call in progress", async () => {
    const tree = await mountMessageCall("kevin");
    await connect();

    press(touchable(tree.root, "call-minimize"));

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(chat!.inCallThreadId).toBe("kevin");
  });
});

describe("Love voice call", () => {
  it("binds the call layer to Chad, shows his face, and hang-up returns to his chat", async () => {
    const tree = await mountLoveCall("chad", "Chad");
    await connect();

    expect(session).toMatchObject({ layer: "call", minimized: false });
    expect(session?.companionId).toBe("chad");
    expect(session?.chat?.inCall).toBe(true);
    expect(typeof session?.callStartedAt).toBe("number");
    expect(texts(tree.root)).toContain("Chad");
    expect(imageUris(tree.root)).toContainEqual(uriOf(faceSourceForId("chad")));
    expect(imageUris(tree.root).filter(isKevinPhoto)).toEqual([]);

    press(touchable(tree.root, "call-hangup"));
    await settle();

    expect(session?.chat?.inCall).toBe(false);
    expect(session?.callStartedAt).toBeNull();
    expect(session?.layer).toBe("chat");
    expect(ttsStopMock).toHaveBeenCalled();
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("minimize keeps the Love session so the pill can restore the call", async () => {
    const tree = await mountLoveCall("chad", "Chad");
    await connect();

    press(touchable(tree.root, "call-minimize"));
    await settle();

    expect(session).toMatchObject({
      layer: "call",
      minimized: true,
      companionId: "chad",
    });
    expect(session?.chat?.inCall).toBe(true);
    expect(mockNavigation.dispatch).toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it("a spoken turn is answered as Chad and lands in the Love transcript", async () => {
    await saveArkKey();
    stopVoice.mockResolvedValue({ ok: true, text: "Hey Chad" });
    const tree = await mountLoveCall("chad", "Chad");
    await connect();

    await holdAndRelease(tree.root);

    const [body] = arkBodies();
    expect(body.messages[0].content).toContain("You are Chad");
    expect(body.messages[body.messages.length - 1]).toEqual({
      role: "user",
      content: "Hey Chad",
    });
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({ text: "我在呢。" });
    const bubbles = (session?.chat?.messages ?? []).filter(
      (item) => item.kind === "bubble"
    ) as { from: string; text: string }[];
    expect(bubbles.slice(-2).map((b) => [b.from, b.text])).toEqual([
      ["me", "Hey Chad"],
      ["them", "我在呢。"],
    ]);
    expect(texts(tree.root)).toContain("Chad is speaking");
  });

  it("video mode on a Love call shows a crafted companion's look and the front camera", async () => {
    await saveCompanions("demo", {
      companions: [nova],
      activeCompanionId: null,
    });
    const tree = await mountLoveCall(nova.id, nova.name);
    await connect();

    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    const stage = stageFace(tree.root);
    const viewer = stage.findAllByType(InlineAvatarViewer);
    expect(viewer).toHaveLength(1);
    expect(viewer[0].props.look).toEqual(lookFromCompanion(nova));
    expect(viewer[0].props.viewMode).toBe("bust");
    expect(webViews(stage)).toHaveLength(1);
    expect(engine?.slot ?? null).toBeNull();
    expect(cameraHosts(tree.root)).toHaveLength(1);
    expect(imageUris(tree.root).filter(isKevinPhoto)).toEqual([]);
    expect(texts(tree.root)).toContain("Nova");
  });
});

describe("call status copy", () => {
  it("names each phase of the loop", () => {
    expect(callStatusLabel({ phase: "connecting", name: "Kevin" })).toBe(
      "Calling Kevin"
    );
    expect(callStatusLabel({ phase: "ready", name: "Kevin" })).toBe("Connected");
    expect(callStatusLabel({ phase: "listening", name: "Kevin" })).toBe(
      "Listening…"
    );
    expect(callStatusLabel({ phase: "thinking", name: "Kevin" })).toBe(
      "Thinking…"
    );
    expect(callStatusLabel({ phase: "speaking", name: "Kevin" })).toBe(
      "Kevin is speaking"
    );
  });

  it("labels the hold button by phase", () => {
    expect(holdButtonLabel("connecting")).toBe("Connecting…");
    expect(holdButtonLabel("ready")).toBe("Hold to talk");
    expect(holdButtonLabel("listening")).toBe("Release to send");
    expect(holdButtonLabel("thinking")).toBe("Hold to talk");
    expect(holdButtonLabel("speaking")).toBe("Hold to interrupt");
  });
});

describe("no call surface hard-codes a stock face or an unguarded native view", () => {
  it.each([
    "src/screens/call/call-body.tsx",
    "src/screens/call/video-stage.tsx",
    "src/screens/chat/call.tsx",
    "src/screens/love/call.tsx",
  ])("%s resolves the person's face instead of faceSourceForId / call-face.png", (file) => {
    const source = readFileSync(join(__dirname, "..", file), "utf8");
    expect(source).not.toContain("faceSourceForId(");
    expect(source).not.toContain("call-face.png");
  });

  it("only asks UIManager-registered native views of requireNativeComponent (a missing view is a Release RCTFatal)", () => {
    const source = readFileSync(
      join(__dirname, "../src/native/camera-preview.ts"),
      "utf8"
    );
    expect(source).toContain("getViewManagerConfig");
    expect(source.indexOf("getViewManagerConfig")).toBeLessThan(
      source.indexOf("requireNativeComponent<")
    );
  });

  it("PHNative hosts the front-camera preview without touching the voice audio session, and speak() leaves Record", () => {
    const source = readFileSync(
      join(__dirname, "../ios/AppFrontend/PHNative.mm"),
      "utf8"
    );
    expect(source).toContain("RCT_EXPORT_MODULE(PHCameraPreview)");
    expect(source).toContain("automaticallyConfiguresApplicationAudioSession = NO");
    expect(source).toContain("AVCaptureDevicePositionFront");
    expect(source).toContain("requestAccessForMediaType:AVMediaTypeVideo");
    // After voice input the shared session is left in Record (no output
    // route); speak() must move it to a playback category or the reply is
    // silent.
    const speak = source.slice(
      source.indexOf("RCT_REMAP_METHOD(speak,"),
      source.indexOf("RCT_REMAP_METHOD(stopSpeaking,")
    );
    expect(speak).toContain("ensurePlaybackAudioSession");
  });
});
