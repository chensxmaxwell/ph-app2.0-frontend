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
import { readdirSync, readFileSync } from "fs";
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
import { SEED_VOICES, voiceById } from "../src/services/voices";
import {
  listenForUtterance,
  stopVoiceInput,
  UtteranceEnd,
  UtteranceResult,
} from "../src/services/voice-input";
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
import { GlobalMessageCallPill } from "../src/screens/chat/call-pill";
import { LoveCallScreen } from "../src/screens/love/call";
import { LoveChatScreen } from "../src/screens/love/chat";
import { AvatarPreview } from "../src/screens/avatar/engine/AvatarPreview";
import { useAvatarEngine } from "../src/screens/avatar/engine/AvatarEngineHost";
import { InlineAvatarViewer } from "../src/screens/avatar/engine/InlineAvatarViewer";
import { DEFAULT_DRAFT } from "../src/screens/avatar/context";
import {
  CALL_CONNECT_DELAY_MS,
  LISTEN_IDLE_MS,
  LISTEN_RECOVER_DELAY_MS,
  LISTEN_RETRY_DELAY_MS,
  LISTEN_SILENCE_MS,
  LISTEN_UNRESPONSIVE_COPY,
  OPENER_TIMEOUT_MS,
  useVoiceCall,
} from "../src/screens/call/use-voice-call";
import {
  CAMERA_START_TIMEOUT_MS,
  CAMERA_STARTING_COPY,
} from "../src/screens/call/camera-preview";
import { localOpener, OPENER_INSTRUCTION } from "../src/screens/call/opener";
import {
  CALL_PHASES,
  callStatusLabel,
  micButtonEnabled,
  micButtonLabel,
  modeToggle,
  voiceKeyHint,
} from "../src/screens/call/status";

/**
 * The phone icon on a Message thread and on Love chat used to open a timer
 * and a face with no audio behind it. These tests drive the real call
 * screens inside the app's providers with the speech, Ark and TTS edges
 * mocked, and check the hands-free loop Maxwell asked for on TestFlight
 * 1.2 (15): the companion greets first, then the call listens on its own
 * (no hold-to-talk) → recognized text → Ark reply → spoken → listens again,
 * plus barge-in by tap, mute, the video stage, the missing-key copy and
 * hang-up. Nothing said on the call reaches a chat.
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
  nativeListenForUtterance: jest.fn(),
}));
// iOS Speech framework through PHNative: the call asks for one utterance at
// a time and the native side decides when the user has finished talking.
// Mocked at the service edge so the loop above it is real.
jest.mock("../src/services/voice-input", () => ({
  startVoiceInput: jest.fn(),
  stopVoiceInput: jest.fn(),
  listenForUtterance: jest.fn(),
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

const listenMock = listenForUtterance as jest.Mock<typeof listenForUtterance>;
const stopVoice = stopVoiceInput as jest.Mock<typeof stopVoiceInput>;
// The recognizer resolves the newest listen when the test "says" something.
let pendingListen: ((result: UtteranceResult) => void) | null = null;

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

// The mic control: tap to interrupt while the companion speaks, tap to mute
// while listening, tap to resume. There is no hold-to-talk any more.
const micButton = (root: ReactTestInstance) => touchable(root, "call-mic");

const holdControls = (root: ReactTestInstance) =>
  root.findAll(
    (node) =>
      node.props?.testID === "call-hold" ||
      typeof node.props?.onPressIn === "function"
  );

const press = (node: ReactTestInstance) => {
  act(() => {
    node.props.onPress();
  });
};

// The user talks: the newest listen resolves with what the recognizer heard.
const say = async (text: string, end: UtteranceEnd = "utterance") => {
  const deliver = pendingListen;
  pendingListen = null;
  if (!deliver) {
    throw new Error("The call is not listening");
  }
  act(() => {
    deliver({ ok: true, text, end });
  });
  await settle();
};

const failListen = async (message: string, reason = "permission-denied") => {
  const deliver = pendingListen;
  pendingListen = null;
  if (!deliver) {
    throw new Error("The call is not listening");
  }
  act(() => {
    deliver({ ok: false, reason, message });
  });
  await settle();
};

// The companion finishes what it is saying.
const finishSpeech = async () => {
  act(() => {
    finishSpeaking?.();
    finishSpeaking = null;
  });
  await settle();
};

// Ring → connected → the companion's opener is spoken → listening.
const connectAndGreet = async () => {
  await connect();
  await finishSpeech();
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
  listenMock.mockReset();
  stopVoice.mockReset();
  pendingListen = null;
  listenMock.mockImplementation(
    () =>
      new Promise<UtteranceResult>((resolve) => {
        pendingListen = resolve;
      })
  );
  stopVoice.mockResolvedValue({ ok: true, text: "" });
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
  it("starts without an Ark key: greets with a local opener, shows the Companion AI settings copy and does not crash", async () => {
    const tree = await mountMessageCall("kevin");
    await connect();

    expect(chat!.inCallThreadId).toBe("kevin");
    const copy = texts(tree.root).join("\n");
    expect(copy).toMatch(/Companion AI/);
    expect(copy).toMatch(/Add a key/);
    expect(global.fetch).not.toHaveBeenCalled();
    // The call is still a call: connected, timer running, hang-up available,
    // and Kevin still says hello (a canned line, in his voice).
    expect(texts(tree.root)).toContain("Kevin is speaking");
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      voiceId: SEED_VOICES.kevin,
    });
    expect((speakMock.mock.calls[0][0] as { text: string }).text).toContain(
      "Kevin"
    );
    expect(() => touchable(tree.root, "call-hangup")).not.toThrow();
  });

  it("on connect Kevin speaks first, in his own voice, and only then starts listening", async () => {
    await saveArkKey();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(arkReply("Hey you. Took you long enough."))
    );
    const tree = await mountMessageCall("kevin");
    expect(texts(tree.root)).toContain("Calling Kevin");
    expect(listenMock).not.toHaveBeenCalled();

    await connect();

    // The opener is asked of Ark as Kevin, with the thread as context and a
    // stage direction instead of a user turn.
    const [body] = arkBodies();
    expect(body.messages[0].content).toContain("You are Kevin");
    expect(body.messages[body.messages.length - 1]).toEqual({
      role: "system",
      content: OPENER_INSTRUCTION,
    });
    expect(body.messages.length).toBeGreaterThan(2);
    // Spoken before anyone is asked to talk, in Kevin's own (male) voice,
    // asking Doubao for its expressive rendering.
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      text: "Hey you. Took you long enough.",
      voiceId: SEED_VOICES.kevin,
      expressive: true,
    });
    expect(voiceById(SEED_VOICES.kevin)?.gender).toBe("male");
    expect(texts(tree.root)).toContain("Kevin is speaking");
    expect(texts(tree.root)).toContain("Hey you. Took you long enough.");
    expect(listenMock).not.toHaveBeenCalled();

    await finishSpeech();

    // Hands-free: the mic opens on its own once he has finished — no tap
    // was simulated anywhere between the ring and this listen.
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock.mock.calls[0][0]).toMatchObject({
      silenceMs: LISTEN_SILENCE_MS,
      idleMs: LISTEN_IDLE_MS,
    });
    expect(texts(tree.root)).toContain("Listening…");
    expect(texts(tree.root)).toContain(
      micButtonLabel({ phase: "listening", muted: false })
    );
    // No hold-to-talk control anywhere on the call, and nothing ever asked
    // for a tap to talk.
    expect(holdControls(tree.root)).toHaveLength(0);
    expect(texts(tree.root).join("\n")).not.toMatch(
      /Hold to talk|Tap to talk/i
    );
  });

  it("while Kevin's opener is still on its way the call reads Connected with an inert mic that says Connecting… — never Tap to talk", async () => {
    // Maxwell, TestFlight 1.2 (18), Chad call at 00:01: status Connected,
    // mic label "Tap to talk". That is the window between the ring and the
    // opener coming back from Ark; it must read as the mic connecting.
    await saveArkKey();
    let deliverOpener: ((value: unknown) => void) | null = null;
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deliverOpener = resolve;
        })
    );
    const tree = await mountMessageCall("kevin");
    await connect();

    // Connected, timer showing, nothing spoken or heard yet.
    expect(texts(tree.root)).toContain("Connected");
    expect(texts(tree.root)).toContain("00:00");
    expect(speakMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();
    expect(texts(tree.root)).toContain(
      micButtonLabel({ phase: "greeting", muted: false })
    );
    expect(texts(tree.root).join("\n")).not.toMatch(/Tap to talk/i);
    expect(micButton(tree.root).props.disabled).toBe(true);
    // A tap now must not skip the greeting or open the mic.
    press(micButton(tree.root));
    await settle();
    expect(listenMock).not.toHaveBeenCalled();

    act(() => {
      deliverOpener?.(arkReply("Hey you."));
    });
    await settle();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Kevin is speaking");
    expect(micButton(tree.root).props.disabled).toBe(false);
    expect(texts(tree.root)).toContain(
      micButtonLabel({ phase: "speaking", muted: false })
    );

    await finishSpeech();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("an opener Companion AI never delivers is replaced by the canned line after OPENER_TIMEOUT_MS, and the mic then opens on its own", async () => {
    // The mic is inert while the opener is on its way, so that wait must be
    // bounded: a stalled request cannot leave the call with no way to talk.
    await saveArkKey();
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => undefined)
    );
    const tree = await mountMessageCall("kevin");
    await connect();
    expect(speakMock).not.toHaveBeenCalled();
    expect(OPENER_TIMEOUT_MS).toBeGreaterThanOrEqual(3000);
    expect(OPENER_TIMEOUT_MS).toBeLessThanOrEqual(10000);

    act(() => {
      jest.advanceTimersByTime(OPENER_TIMEOUT_MS - 10);
    });
    await settle();
    expect(speakMock).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(20);
    });
    await settle();

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      text: localOpener("Kevin"),
      voiceId: SEED_VOICES.kevin,
    });
    expect(texts(tree.root)).toContain("Kevin is speaking");
    await finishSpeech();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("a spoken turn: recognized speech goes to Ark as Kevin, the reply is spoken while the face shows speaking, then the call listens again", async () => {
    await saveArkKey();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(arkReply("Hey you."))
    );
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    expect(listenMock).toHaveBeenCalledTimes(1);

    await say("你好 Kevin");

    const [, body] = arkBodies();
    expect(body.model).toBe(ARK_MODEL);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("You are Kevin");
    // Kevin's seeded thread history rides along, then what was said on this
    // call so far (his opener), then the new line.
    expect(body.messages.length).toBeGreaterThan(3);
    expect(body.messages.slice(-2)).toEqual([
      { role: "assistant", content: "Hey you." },
      { role: "user", content: "你好 Kevin" },
    ]);

    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock.mock.calls[1][0]).toMatchObject({
      text: "我在呢。",
      voiceId: SEED_VOICES.kevin,
      expressive: true,
    });
    const copy = texts(tree.root);
    expect(copy).toContain("Kevin is speaking");
    expect(copy).toContain("你好 Kevin");
    expect(copy).toContain("我在呢。");
    expect(copy).toContain(micButtonLabel({ phase: "speaking", muted: false }));
    // The spoken turn stays on the call: the Message thread is untouched.
    const kevin = chat!.getThread("kevin")!;
    expect(kevin.messages.map((m) => m.text)).not.toContain("你好 Kevin");
    expect(kevin.messages.map((m) => m.text)).not.toContain("我在呢。");

    await finishSpeech();
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("what is said on a call never enters the Message thread, not during the call and not on hang-up", async () => {
    // Maxwell, TestFlight 1.2 (15): the call's You / Kevin lines showed up
    // in the Message chat afterwards. The conversation belongs to the call
    // UI only; the thread must read exactly as it did before the call.
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    const before = chat!.getThread("kevin")!;
    await say("你好 Kevin");
    expect(texts(tree.root)).toContain("我在呢。");
    await finishSpeech();

    press(touchable(tree.root, "call-hangup"));
    await settle();

    const after = chat!.getThread("kevin")!;
    expect(after.messages).toEqual(before.messages);
    expect(after.preview).toBe(before.preview);
    expect(after.lastActivityAt).toBe(before.lastActivityAt);
    expect(chat!.inCallThreadId).toBeNull();
  });

  it("the second turn is still grounded in the first, from the call's own transcript", async () => {
    await saveArkKey();
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve(arkReply("Hi.")))
      .mockImplementationOnce(() => Promise.resolve(arkReply("Hey you.")))
      .mockImplementationOnce(() => Promise.resolve(arkReply("Still here.")));
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();

    await say("Hello Kevin");
    await finishSpeech();
    await say("What did I just say?");

    const [, , third] = arkBodies();
    expect(third.messages.slice(-4)).toEqual([
      { role: "assistant", content: "Hi." },
      { role: "user", content: "Hello Kevin" },
      { role: "assistant", content: "Hey you." },
      { role: "user", content: "What did I just say?" },
    ]);
    expect(chat!.getThread("kevin")!.messages.map((m) => m.text)).not.toContain(
      "Hello Kevin"
    );
    expect(tree.root).toBeTruthy();
  });

  it("a listen that ends with nothing said is simply restarted, with no nagging and no Ark call", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    (global.fetch as jest.Mock).mockClear();

    // The recognizer listened for its whole idle window and heard nothing.
    act(() => {
      jest.advanceTimersByTime(LISTEN_IDLE_MS);
    });
    await say("", "idle");
    act(() => {
      jest.advanceTimersByTime(LISTEN_IDLE_MS);
    });
    await say("   ");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledTimes(3);
    expect(texts(tree.root)).toContain("Listening…");
    expect(texts(tree.root).join("\n")).not.toMatch(/Didn't catch that/);
  });

  it("a recognizer that gives up at once is retried with a pause; after three in a row the call says so and keeps trying on its own, slower — no tap needed", async () => {
    // iOS Speech without a network errors out right after it starts; the
    // native side hands that back as an empty listen. Reopening the mic in
    // a tight loop would tear the audio engine down and up dozens of times
    // a second — but stopping and asking for a tap (1.2 (16)) made the call
    // push-to-talk again the moment the recognizer hiccupped.
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    expect(listenMock).toHaveBeenCalledTimes(1);

    await say("", "idle");
    // Not reopened immediately…
    expect(listenMock).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(LISTEN_RETRY_DELAY_MS + 10);
    });
    await settle();
    // …but after a pause.
    expect(listenMock).toHaveBeenCalledTimes(2);

    await say("", "idle");
    act(() => {
      jest.advanceTimersByTime(LISTEN_RETRY_DELAY_MS + 10);
    });
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(3);

    await say("", "idle");
    // Three instant give-ups in a row: say so, and stay the call's job.
    expect(texts(tree.root)).toContain(LISTEN_UNRESPONSIVE_COPY);
    expect(LISTEN_UNRESPONSIVE_COPY).not.toMatch(/tap/i);
    expect(texts(tree.root)).toContain("Listening…");
    expect(texts(tree.root).join("\n")).not.toMatch(
      /Tap to talk|Tap to resume/i
    );
    act(() => {
      jest.advanceTimersByTime(LISTEN_RETRY_DELAY_MS + 10);
    });
    await settle();
    // Not at the quick pace any more…
    expect(listenMock).toHaveBeenCalledTimes(3);
    act(() => {
      jest.advanceTimersByTime(LISTEN_RECOVER_DELAY_MS - LISTEN_RETRY_DELAY_MS);
    });
    await settle();
    // …but it does try again, with no tap.
    expect(LISTEN_RECOVER_DELAY_MS).toBeGreaterThan(LISTEN_RETRY_DELAY_MS);
    expect(listenMock).toHaveBeenCalledTimes(4);

    // A listen that runs its whole window means the recognizer is back: the
    // notice goes away on its own.
    act(() => {
      jest.advanceTimersByTime(LISTEN_IDLE_MS);
    });
    await say("", "idle");
    expect(listenMock).toHaveBeenCalledTimes(5);
    expect(texts(tree.root)).not.toContain(LISTEN_UNRESPONSIVE_COPY);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("a tap while the call is nursing an unresponsive recognizer mutes it and the retries stop; the next tap listens at once", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await say("", "idle");
      if (attempt < 2) {
        act(() => {
          jest.advanceTimersByTime(LISTEN_RETRY_DELAY_MS + 10);
        });
        await settle();
      }
    }
    expect(listenMock).toHaveBeenCalledTimes(3);
    expect(texts(tree.root)).toContain(LISTEN_UNRESPONSIVE_COPY);

    press(micButton(tree.root));
    await settle();
    expect(texts(tree.root)).toContain(
      micButtonLabel({ phase: "ready", muted: true })
    );
    expect(texts(tree.root)).not.toContain(LISTEN_UNRESPONSIVE_COPY);
    act(() => {
      jest.advanceTimersByTime(LISTEN_RECOVER_DELAY_MS * 3);
    });
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(3);

    press(micButton(tree.root));
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(4);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("a recognizer that fails for a reason that can pass is reopened on its own after a pause; the failure is only shown once it keeps failing", async () => {
    // `unavailable` (no network for iOS Speech, no input format) and
    // `start-failed` (the audio session was busy) clear up on their own;
    // only the permission needs the user.
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    const unavailable = "Voice input is not available on this build.";

    await failListen(unavailable, "unavailable");
    expect(texts(tree.root)).toContain("Listening…");
    expect(texts(tree.root)).not.toContain(unavailable);
    expect(listenMock).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(LISTEN_RETRY_DELAY_MS + 10);
    });
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(2);

    await failListen(
      "Could not start the microphone. Try again.",
      "start-failed"
    );
    act(() => {
      jest.advanceTimersByTime(LISTEN_RETRY_DELAY_MS + 10);
    });
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(3);

    await failListen(unavailable, "unavailable");
    // Three in a row: the call shows the failure and keeps trying, slower.
    expect(texts(tree.root)).toContain(unavailable);
    expect(texts(tree.root).join("\n")).not.toMatch(
      /Tap to talk|Tap to resume/i
    );
    act(() => {
      jest.advanceTimersByTime(LISTEN_RECOVER_DELAY_MS + 10);
    });
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(4);

    // The recognizer is back and hears something: the notice goes and the
    // turn is answered as usual.
    await say("你好 Kevin");
    expect(texts(tree.root)).not.toContain(unavailable);
    expect(texts(tree.root)).toContain("Kevin is speaking");
  });

  it("tapping the mic while Kevin speaks interrupts him and listens right away", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    await say("你好 Kevin");
    expect(texts(tree.root)).toContain("Kevin is speaking");
    expect(listenMock).toHaveBeenCalledTimes(1);
    ttsStopMock.mockClear();

    press(micButton(tree.root));
    await settle();

    expect(ttsStopMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
    // The interrupted reply stays in the transcript as what he got to say.
    expect(texts(tree.root)).toContain("我在呢。");
  });

  it("tapping the mic while listening mutes the call; tapping again resumes", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    expect(listenMock).toHaveBeenCalledTimes(1);

    press(micButton(tree.root));
    await settle();

    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain(
      micButtonLabel({ phase: "ready", muted: true })
    );
    expect(texts(tree.root)).toContain("Connected");
    // Whatever the recognizer still returns for the muted listen is dropped:
    // no Ark call, no new listen.
    (global.fetch as jest.Mock).mockClear();
    await say("你好 Kevin");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);

    press(micButton(tree.root));
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("a denied microphone shows the permission copy and stays on the call without looping", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();

    await failListen("Microphone access is needed to use voice input.");

    expect(texts(tree.root)).toContain(
      "Microphone access is needed to use voice input."
    );
    expect(texts(tree.root)).toContain("Connected");
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(chat!.inCallThreadId).toBe("kevin");
    // Only Settings can fix this, so retrying on a timer would fail at once
    // every time: the loop stays stopped…
    act(() => {
      jest.advanceTimersByTime(LISTEN_RECOVER_DELAY_MS * 3);
    });
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(1);
    // …and the last-resort tap reads as resuming, never as tapping to talk.
    expect(texts(tree.root)).toContain(
      micButtonLabel({ phase: "ready", muted: false })
    );
    expect(texts(tree.root)).toContain("Tap to resume");
    expect(texts(tree.root).join("\n")).not.toMatch(/Tap to talk/i);
    press(micButton(tree.root));
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("a call that is already running is listening from its very first frame — no resume label ever flashes", async () => {
    const phases: string[] = [];
    const PhaseProbe = () => {
      const call = useVoiceCall({
        name: "Chad",
        history: [],
        connectDelayMs: 0,
      });
      phases.push(call.phase);
      return null;
    };
    act(() => {
      trees.push(renderer.create(<PhaseProbe />));
    });
    await settle();

    expect(phases[0]).toBe("listening");
    expect(new Set(phases)).toEqual(new Set(["listening"]));
    expect(listenMock).toHaveBeenCalledTimes(1);
  });

  it("re-entering a Message call that is already in progress neither rings nor greets again", async () => {
    await saveArkKey();
    mockNavigation = fakeNavigation();
    mockRoute = {
      name: String(SCREENS.CHAT_CALL),
      params: { threadId: "kevin" },
    };
    let tree: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Providers>{null}</Providers>);
    });
    trees.push(tree!);
    await settle();
    act(() => {
      chat!.setInCall("kevin");
    });
    act(() => {
      tree.update(
        <Providers>
          <ChatCallScreen />
        </Providers>
      );
    });
    await settle();

    // Straight into the call: no ring, no opener, the mic already open.
    expect(texts(tree!.root)).not.toContain("Calling Kevin");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree!.root)).toContain("Listening…");
    expect(texts(tree!.root)).toContain("00:00");
  });

  it("says it is using the phone's voice until a Voice key is saved in Companion AI", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    expect(texts(tree.root)).toContain(voiceKeyHint("Kevin"));
    expect(voiceKeyHint("Kevin")).toMatch(/Voice key/);
    expect(voiceKeyHint("Kevin")).toMatch(/Companion AI/);
    act(() => {
      trees.splice(0).forEach((item) => item.unmount());
    });

    await saveLlmConfig({
      apiKey: "ark-device-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
      ttsApiKey: "speech-console-key",
    });
    const withKey = await mountMessageCall("kevin");
    await connectAndGreet();
    expect(texts(withKey.root)).not.toContain(voiceKeyHint("Kevin"));
  });

  it("switching video on and off keeps the conversation and shows Amanda, not Kevin's stock face", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("amanda");
    await connectAndGreet();
    await say("Hi Amanda");
    expect(texts(tree.root)).toContain("Amanda is speaking");
    // Amanda greets and answers in a woman's voice.
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      voiceId: SEED_VOICES.amanda,
    });
    expect(speakMock.mock.calls[1][0]).toMatchObject({
      voiceId: SEED_VOICES.amanda,
    });
    expect(voiceById(SEED_VOICES.amanda)?.gender).toBe("female");

    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    // Main stage: this person's portrait. PiP: the front camera.
    expect(imageUris(stageFace(tree.root))).toEqual([
      uriOf(faceSourceForId("amanda")),
    ]);
    expect(imageUris(tree.root).filter(isKevinPhoto)).toEqual([]);
    expect(cameraHosts(tree.root)).toHaveLength(1);
    expect(cameraHosts(tree.root)[0].props.facing).toBe("front");
    // The loop did not restart or lose its captions.
    const copy = texts(tree.root);
    expect(copy).toContain("Amanda is speaking");
    expect(copy).toContain("Hi Amanda");
    expect(copy).toContain("我在呢。");
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(listenMock).toHaveBeenCalledTimes(1);

    press(touchable(tree.root, "call-video-toggle"));
    await settle();
    expect(cameraHosts(tree.root)).toHaveLength(0);
    expect(texts(tree.root)).toContain("Hi Amanda");
    expect(texts(tree.root)).toContain("Amanda is speaking");
  });

  it("the mode toggle's icon and label agree: a camera to go to Video, a handset to go back to Voice", async () => {
    // TestFlight 1.2 (14): in video mode the control showed a camera glyph
    // under the word "Voice". Icon and label both name the target mode.
    const tree = await mountMessageCall("amanda");
    await connect();
    const toggle = () => touchable(tree.root, "call-video-toggle");
    // A View matches as both the composite and its host node: dedupe.
    const iconIds = () =>
      Array.from(
        new Set(
          toggle()
            .findAll((node) =>
              /^call-mode-icon-/.test(String(node.props?.testID))
            )
            .map((node) => String(node.props.testID))
        )
      );
    const labelOf = () =>
      texts(tree.root).filter((copy) => copy === "Video" || copy === "Voice");

    expect(labelOf()).toEqual(["Video"]);
    expect(iconIds()).toEqual(["call-mode-icon-video"]);

    press(toggle());
    await settle();
    expect(labelOf()).toEqual(["Voice"]);
    expect(iconIds()).toEqual(["call-mode-icon-voice"]);

    press(toggle());
    await settle();
    expect(labelOf()).toEqual(["Video"]);
    expect(iconIds()).toEqual(["call-mode-icon-video"]);
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

  it("the PiP is never a bare box: it says the camera is starting until the native view reports frames", async () => {
    // TestFlight 1.2 (14): the PiP was an empty dark rectangle. The native
    // view now reports `running` once AVCaptureSession delivers, and until
    // then (or on any other state) the PiP carries copy.
    const tree = await mountMessageCall("chad");
    await connect();
    press(touchable(tree.root, "call-video-toggle"));
    await settle();

    const pip = () =>
      tree.root.findAll((node) => node.props?.testID === "call-camera-pip")[0];
    expect(cameraHosts(pip())).toHaveLength(1);
    expect(texts(pip())).toContain(CAMERA_STARTING_COPY);

    act(() => {
      cameraHosts(pip())[0].props.onStatusChange({
        nativeEvent: { status: "authorized", message: "" },
      });
    });
    expect(texts(pip())).toContain(CAMERA_STARTING_COPY);

    act(() => {
      cameraHosts(pip())[0].props.onStatusChange({
        nativeEvent: { status: "running", message: "" },
      });
    });
    expect(texts(pip())).toEqual([]);
    expect(cameraHosts(pip())).toHaveLength(1);

    // A late "configured" report never covers a preview that is already
    // painting (and never restarts the stall timer over it).
    act(() => {
      cameraHosts(pip())[0].props.onStatusChange({
        nativeEvent: { status: "authorized", message: "" },
      });
    });
    expect(texts(pip())).toEqual([]);
    act(() => {
      jest.advanceTimersByTime(CAMERA_START_TIMEOUT_MS + 50);
    });
    expect(texts(pip())).toEqual([]);

    act(() => {
      cameraHosts(pip())[0].props.onStatusChange({
        nativeEvent: { status: "interrupted", message: "" },
      });
    });
    expect(texts(pip()).join("\n")).toMatch(/Camera paused/);
    act(() => {
      cameraHosts(pip())[0].props.onStatusChange({
        nativeEvent: { status: "running", message: "" },
      });
    });
    expect(texts(pip())).toEqual([]);
  });

  it("a camera that never starts says so and Retry remounts the native view", async () => {
    const tree = await mountMessageCall("chad");
    await connect();
    press(touchable(tree.root, "call-video-toggle"));
    await settle();
    const pip = () =>
      tree.root.findAll((node) => node.props?.testID === "call-camera-pip")[0];
    const [first] = cameraHosts(pip());

    act(() => {
      jest.advanceTimersByTime(CAMERA_START_TIMEOUT_MS + 50);
    });
    expect(texts(pip()).join("\n")).toMatch(/Camera didn't start/);
    expect(texts(pip())).toContain("Retry");

    press(touchable(pip(), "call-camera-retry"));
    await settle();
    expect(texts(pip())).toContain(CAMERA_STARTING_COPY);
    expect(cameraHosts(pip())).toHaveLength(1);
    expect(cameraHosts(pip())[0]).not.toBe(first);
    // A view that comes up after the retry clears the copy.
    act(() => {
      cameraHosts(pip())[0].props.onStatusChange({
        nativeEvent: { status: "running", message: "" },
      });
    });
    expect(texts(pip())).toEqual([]);
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

  it("hang-up stops the mic and the voice, clears in-call and leaves; a late utterance is dropped", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    await say("你好 Kevin");
    await finishSpeech();
    expect(speakMock).toHaveBeenCalledTimes(2);
    // The call is listening again when the user hangs up.
    expect(texts(tree.root)).toContain("Listening…");
    stopVoice.mockClear();
    (global.fetch as jest.Mock).mockClear();

    press(touchable(tree.root, "call-hangup"));
    await settle();

    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(ttsStopMock).toHaveBeenCalled();
    expect(chat!.inCallThreadId).toBeNull();
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    // What the recognizer returns after that goes nowhere.
    await say("one more thing");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(2);
  });

  it("a reply that arrives after hang-up is not spoken", async () => {
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    let deliver: ((value: unknown) => void) | null = null;
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        })
    );
    await say("你好 Kevin");
    expect(texts(tree.root)).toContain("Thinking…");
    speakMock.mockClear();

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

  it("minimize leaves a floating face pill over the thread that keeps the call's clock; tapping it restores the call with no ring and no second greeting; hang-up clears it", async () => {
    // Maxwell, TestFlight 1.2 (18): top-left minimize on the Chad call
    // landed on the plain Chad thread — no 头像小窗, nothing to say a call
    // was on, no way back but the drawer. Love has its pill; Message gets
    // one of its own, global like Love's, wearing this person's face and the
    // running call time.
    await saveArkKey();
    const tree = await mountMessageCall("kevin");
    await connectAndGreet();
    await say("你好 Kevin");
    await finishSpeech();
    expect(speakMock).toHaveBeenCalledTimes(2);
    const before = chat!.getThread("kevin")!;
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    await settle();
    const clock = (root: ReactTestInstance) =>
      texts(root).find((copy) => /^\d\d:\d\d$/.test(copy));
    const onCall = clock(tree.root);
    expect(onCall).toBe("00:05");
    // No pill while the call screen itself is up.
    const pill = () =>
      tree.root.findAll(
        (node) => node.props?.testID === "message-call-pill"
      )[0];
    act(() => {
      tree.update(
        <Providers>
          <ChatCallScreen />
          <GlobalMessageCallPill />
        </Providers>
      );
    });
    await settle();
    expect(pill()).toBeUndefined();

    press(touchable(tree.root, "call-minimize"));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(chat!.inCallThreadId).toBe("kevin");
    // goBack took the call screen down; the thread is what is left, and the
    // pill floats over it.
    stopVoice.mockClear();
    act(() => {
      tree.update(
        <Providers>
          <GlobalMessageCallPill />
        </Providers>
      );
    });
    await settle();
    // The screen going away closes the mic (the thread has its own).
    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(pill()).toBeTruthy();
    expect(imageUris(pill()).some(isKevinPhoto)).toBe(true);
    expect(clock(pill())).toBe("00:05");
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    await settle();
    expect(clock(pill())).toBe("00:08");

    // Back to the call through the pill: no ring, no opener, listening at
    // once, the clock where it was, the pill gone.
    speakMock.mockClear();
    listenMock.mockClear();
    (global.fetch as jest.Mock).mockClear();
    press(pill());
    expect(mockNavigation.navigate).toHaveBeenCalledWith(SCREENS.CHAT_CALL, {
      threadId: "kevin",
    });
    act(() => {
      tree.update(
        <Providers>
          <ChatCallScreen />
          <GlobalMessageCallPill />
        </Providers>
      );
    });
    await settle();
    expect(texts(tree.root)).not.toContain("Calling Kevin");
    expect(speakMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Listening…");
    expect(texts(tree.root).join("\n")).not.toMatch(/Tap to talk/i);
    expect(clock(tree.root)).toBe("00:08");
    expect(pill()).toBeUndefined();

    press(touchable(tree.root, "call-hangup"));
    await settle();
    expect(chat!.inCallThreadId).toBeNull();
    act(() => {
      tree.update(
        <Providers>
          <GlobalMessageCallPill />
        </Providers>
      );
    });
    await settle();
    expect(pill()).toBeUndefined();
    // Nothing from the call, before or after the minimize, is in the thread.
    const after = chat!.getThread("kevin")!;
    expect(after.messages).toEqual(before.messages);
    expect(after.messages.map((m) => m.text)).not.toContain("你好 Kevin");
  });

  it("the Message call pill is mounted globally, beside Love's, so it shows on the thread and on every other screen", () => {
    const source = readFileSync(
      join(__dirname, "../navigations/home-stack.tsx"),
      "utf8"
    );
    expect(source).toContain("<GlobalSessionLovePill />");
    expect(source).toContain("<GlobalMessageCallPill />");
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

  it("a spoken turn is answered as Chad on the call and never written to the Love chat", async () => {
    await saveArkKey();
    const tree = await mountLoveCall("chad", "Chad");
    await connectAndGreet();
    const before = session!.chat!.messages;

    await say("Hey Chad");

    const [, body] = arkBodies();
    expect(body.messages[0].content).toContain("You are Chad");
    expect(body.messages[body.messages.length - 1]).toEqual({
      role: "user",
      content: "Hey Chad",
    });
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock.mock.calls[1][0]).toMatchObject({
      text: "我在呢。",
      voiceId: SEED_VOICES.chad,
    });
    expect(voiceById(SEED_VOICES.chad)?.gender).toBe("male");
    expect(texts(tree.root)).toContain("Chad is speaking");
    expect(session!.chat!.messages).toEqual(before);

    await finishSpeech();
    press(touchable(tree.root, "call-hangup"));
    await settle();
    expect(session!.chat!.messages).toEqual(before);
    expect(session!.chat!.inCall).toBe(false);
  });

  it("a Love call restored from the pill is already on: no ring, no second greeting, listening at once", async () => {
    await saveArkKey();
    mockNavigation = fakeNavigation();
    mockRoute = {
      name: String(SCREENS.LOVE_CALL),
      params: { companionId: "chad", name: "Chad" },
    };
    let tree: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Providers>{null}</Providers>);
    });
    trees.push(tree!);
    await settle();
    // The session was minimized mid-call: the call timer is already running.
    act(() => {
      session!.start({ layer: "call", companionId: "chad", name: "Chad" });
      session!.ensureLayerTimer("call");
    });
    await settle();
    act(() => {
      tree.update(
        <Providers>
          <LoveCallScreen />
        </Providers>
      );
    });
    await settle();

    expect(texts(tree!.root)).not.toContain("Calling Chad");
    expect(speakMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    // Whatever was still being said when the pill took over is cut before
    // the mic opens, so the recognizer never hears the companion.
    expect(ttsStopMock).toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree!.root)).toContain("Listening…");
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

describe("Love chat Listen", () => {
  it("reads Amanda's bubbles in her female voice", async () => {
    mockNavigation = fakeNavigation();
    mockRoute = {
      name: String(SCREENS.LOVE_CHAT),
      params: { companionId: "amanda", name: "Amanda" },
    };
    const tree = await mountCall(<LoveChatScreen />);
    act(() => {
      session!.patchChat({ listen: true });
    });
    await settle();

    const listenButtons = tree.root
      .findAllByType(TouchableOpacity)
      .filter((node) => /^love-listen-/.test(String(node.props.testID)));
    expect(listenButtons.length).toBeGreaterThan(0);
    press(listenButtons[0]);
    await settle();

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      voiceId: SEED_VOICES.amanda,
    });
  });
});

describe("call status copy", () => {
  it("names each phase of the loop", () => {
    expect(callStatusLabel({ phase: "connecting", name: "Kevin" })).toBe(
      "Calling Kevin"
    );
    // The companion's first line is on its way: connected, timer running.
    expect(callStatusLabel({ phase: "greeting", name: "Kevin" })).toBe(
      "Connected"
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

  it("the mode toggle names the mode it switches to", () => {
    expect(modeToggle(false)).toEqual({ target: "video", label: "Video" });
    expect(modeToggle(true)).toEqual({ target: "voice", label: "Voice" });
  });

  it("labels the mic button by phase: the mic is connecting until the companion has greeted, then it listens on its own", () => {
    expect(micButtonLabel({ phase: "connecting", muted: false })).toBe(
      "Connecting…"
    );
    // The opener is on its way (Ark): the mic will open by itself after it.
    expect(micButtonLabel({ phase: "greeting", muted: false })).toBe(
      "Connecting…"
    );
    expect(micButtonLabel({ phase: "listening", muted: false })).toBe(
      "Listening"
    );
    expect(micButtonLabel({ phase: "thinking", muted: false })).toBe(
      "Thinking…"
    );
    expect(micButtonLabel({ phase: "speaking", muted: false })).toBe(
      "Tap to interrupt"
    );
    // The loop stopped for something only the user can fix (mic permission,
    // no Ark key): the last-resort tap resumes, it never "starts" talking.
    expect(micButtonLabel({ phase: "ready", muted: false })).toBe(
      "Tap to resume"
    );
    expect(micButtonLabel({ phase: "ready", muted: true })).toBe("Muted");
    expect(micButtonLabel({ phase: "speaking", muted: true })).toBe("Muted");
  });

  it("no phase, muted or not, ever reads Tap to talk or Hold to talk (Maxwell, TestFlight 1.2 (18): 「还是有tap to talk」)", () => {
    expect(CALL_PHASES).toEqual(
      expect.arrayContaining([
        "connecting",
        "greeting",
        "listening",
        "thinking",
        "speaking",
        "ready",
      ])
    );
    CALL_PHASES.forEach((phase) => {
      [false, true].forEach((muted) => {
        expect(micButtonLabel({ phase, muted })).not.toMatch(
          /tap to talk|hold to talk|to talk/i
        );
        expect(callStatusLabel({ phase, name: "Chad" })).not.toMatch(
          /tap to talk|hold to talk|to talk/i
        );
      });
    });
  });

  it("the mic control is inert while the call rings and while the opener is on its way, live from the first spoken word", () => {
    expect(micButtonEnabled("connecting")).toBe(false);
    expect(micButtonEnabled("greeting")).toBe(false);
    expect(micButtonEnabled("speaking")).toBe(true);
    expect(micButtonEnabled("listening")).toBe(true);
    expect(micButtonEnabled("thinking")).toBe(true);
    expect(micButtonEnabled("ready")).toBe(true);
  });

  it("names the Voice key the cloud voice needs", () => {
    expect(voiceKeyHint("Amanda")).toBe(
      "Using the phone's voice. Add a Voice key in Companion AI for Amanda's real voice."
    );
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

  it("the call body has no press-and-hold control", () => {
    const source = readFileSync(
      join(__dirname, "../src/screens/call/call-body.tsx"),
      "utf8"
    );
    expect(source).not.toContain("onPressIn");
    expect(source).not.toContain("onPressOut");
    expect(source).toContain('testID="call-mic"');
  });

  it("no call source carries tap-to-talk or hold-to-talk copy, in any casing", () => {
    // Maxwell, TestFlight 1.2 (18): 「还是有tap to talk」. The words must not
    // come back through any file the call renders.
    const callDir = join(__dirname, "../src/screens/call");
    const files = [
      ...readdirSync(callDir).map((file) => join(callDir, file)),
      join(__dirname, "../src/screens/chat/call.tsx"),
      join(__dirname, "../src/screens/love/call.tsx"),
    ];
    expect(files.length).toBeGreaterThan(5);
    const offenders = files.filter((file) =>
      /tap[ -]to[ -]talk|hold[ -]to[ -]talk/i.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("PHNative listens for one utterance at a time and decides natively when the user has finished", () => {
    const source = readFileSync(
      join(__dirname, "../ios/AppFrontend/PHNative.mm"),
      "utf8"
    );
    expect(source).toContain("RCT_REMAP_METHOD(listenForUtterance,");
    // End of speech = the recognizer's transcript stopped changing and the
    // mic went quiet (RMS below the voice floor) for silenceMs; an empty
    // listen ends as `idle` before iOS Speech's one-minute cap so JS can
    // start it again.
    expect(source).toContain("silenceMs");
    expect(source).toContain("idleMs");
    expect(source).toContain('@"idle"');
    expect(source).toContain('@"utterance"');
    // Hang-up / mute stop the mic through stopVoiceInput and must settle a
    // pending listen instead of leaving its promise hanging.
    const stop = source.slice(
      source.indexOf("RCT_REMAP_METHOD(stopVoiceInput,"),
      source.indexOf("RCT_REMAP_METHOD(requestNotifications,")
    );
    expect(stop).toContain("settleListen");
    // Speech and the synthesizer still never overlap: the mic is closed
    // before the reply is spoken (the loop is sequential in JS) and a listen
    // superseded during the permission prompt never opens the mic.
    expect(source).toContain("voiceGeneration");
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

  it("PHCameraPreview reports running / interrupted / failed from the capture session and restarts after Settings", () => {
    const source = readFileSync(
      join(__dirname, "../ios/AppFrontend/PHNative.mm"),
      "utf8"
    );
    const camera = source.slice(source.indexOf("@implementation PHCameraPreviewView"));
    // TestFlight 1.2 (15): the PiP was a black box with no copy at 00:30 —
    // JS had been told `running` (AVCaptureSessionDidStartRunning fired) and
    // yet nothing painted. The session running is not the layer painting.
    // The preview layer is now the view's own backing layer (no hand-managed
    // sublayer whose frame was copied from bounds that RN had not laid out
    // yet), and `running` is derived from the layer's `previewing` flag,
    // which is true only while it renders frames.
    expect(camera).toContain("+ (Class)layerClass");
    expect(camera).toContain("[AVCaptureVideoPreviewLayer class]");
    expect(camera).not.toContain("addSublayer:");
    expect(camera).not.toContain("layerWithSession:");
    expect(camera).toContain('forKeyPath:@"previewing"');
    expect(camera).toContain('emitStatus:@"running"');
    expect(camera).toContain("AVCaptureSessionRuntimeErrorNotification");
    expect(camera).toContain("AVCaptureSessionWasInterruptedNotification");
    expect(camera).toContain("AVCaptureSessionInterruptionEndedNotification");
    // A session that stops behind our back (another camera client, the
    // view detached and reattached) must not leave JS believing `running`.
    expect(camera).toContain("AVCaptureSessionDidStopRunningNotification");
    expect(camera).toContain('emitStatus:@"interrupted"');
    // Session configuration and start/stop run on the (one, shared) session
    // queue, never the main thread.
    expect(camera).toContain("dispatch_async(PHCameraSessionQueue()");
    // Coming back from Settings after granting access starts the preview
    // without a remount.
    expect(camera).toContain("UIApplicationDidBecomeActiveNotification");
    expect(camera).toContain("removeObserver:self");
  });
});
