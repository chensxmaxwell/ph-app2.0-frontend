import React, { ReactNode } from "react";
import { Text, TouchableOpacity } from "react-native";
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
import {
  ARK_BASE_URL,
  ARK_MODEL,
  saveLlmConfig,
} from "../src/services/llm-config";
import {
  RING_DURATION_MS,
  RING_MIN_MS,
  ringbackToneWav,
} from "../src/services/ringtone";
import { configureTtsEngine } from "../src/services/tts";
import { SEED_VOICES, voiceById } from "../src/services/voices";
import {
  listenForUtterance,
  playAudioWithNative,
  stopNativeTts,
  stopVoiceInput,
  UtteranceEnd,
  UtteranceResult,
} from "../src/services/voice-input";
import { CompanionsProvider } from "../src/store/companions";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import { useOpenLove } from "../src/screens/love/pill";
import {
  LoveSessionProvider,
  useLoveSession,
} from "../src/screens/love/session";
import { clearLoveSessionBoot } from "../src/screens/love/session-persist";
import { LoveSyncScreen } from "../src/screens/love/sync";
import SyncScreen from "../src/screens/sync/sync_screen";
import { saveCompanions } from "../src/backend/store";
import { Companion } from "../src/store/companions";
import { DEFAULT_DRAFT } from "../src/screens/avatar/context";
import {
  CALL_CONNECT_DELAY_MS,
  LISTEN_IDLE_MS,
  LISTEN_SILENCE_MS,
  useVoiceCall,
  VoiceCall,
  VoiceCallInput,
} from "../src/screens/call/use-voice-call";
import { localOpener, OPENER_INSTRUCTION } from "../src/screens/call/opener";
import {
  CALL_PHASES,
  callStatusLabel,
  syncStatusLabel,
} from "../src/screens/call/status";

/**
 * Sync is the Love / Control surface where the companion is meant to talk
 * while it drives the toy over Bluetooth. There is no product yet, so Sync
 * must at least carry the conversation (Maxwell: 「现在没有产品，所以只能语音」).
 * Until this change both Sync screens had a mute and a speaker control that
 * flipped local state over a silent screen. These tests drive the hook that
 * the calls already use and lock the two controls Sync needs from it: a mute
 * that really shuts the mic in every phase, and a speaker switch that
 * silences the companion's voice while the replies stay on screen.
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
jest.mock("../src/native/ph-native", () => ({
  bundledAvatarViewerUrl: () => "file:///avatar-engine/viewer-page.html",
  nativeSpeak: jest.fn(),
  nativeStopSpeaking: jest.fn(),
  nativeStartVoiceInput: jest.fn(),
  nativeStopVoiceInput: jest.fn(),
  nativeListenForUtterance: jest.fn(),
}));
// iOS Speech through PHNative, mocked at the service edge so the loop above
// it is the real one.
jest.mock("../src/services/voice-input", () => ({
  startVoiceInput: jest.fn(),
  stopVoiceInput: jest.fn(),
  listenForUtterance: jest.fn(),
  speakWithNativeTts: jest.fn(),
  stopNativeTts: jest.fn(),
  playAudioWithNative: jest.fn(),
}));
// The mock motor under Sync (Control's HomeScreen context is not mounted
// here). It keeps running beside the voice; it is not what these tests lock.
const mockMotorStop = jest.fn();
jest.mock("../src/hooks/usePatternPlayer", () => ({
  usePatternPlayer: () => ({
    playing: true,
    cursor: 0,
    start: jest.fn(),
    stop: mockMotorStop,
    toggle: jest.fn(),
  }),
}));

type FakeNavigation = {
  dispatch: jest.Mock;
  goBack: jest.Mock;
  navigate: jest.Mock;
  canGoBack: () => boolean;
  getParent: () => FakeNavigation | undefined;
  setOptions: jest.Mock;
  addListener: jest.Mock;
};

const fakeNavigation = (parent?: FakeNavigation): FakeNavigation => ({
  dispatch: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  canGoBack: () => true,
  getParent: () => parent,
  setOptions: jest.fn(),
  addListener: jest.fn(() => () => undefined),
});

let mockNavigation: FakeNavigation = fakeNavigation();
let mockRoute: { name: string; params?: object } = { name: "LoveSync" };
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
// The ring-back tone goes through the native player, the same one the cloud
// voice uses; stopping it is the same native stop.
const ringPlay = playAudioWithNative as jest.Mock<typeof playAudioWithNative>;
const nativeStop = stopNativeTts as jest.Mock<typeof stopNativeTts>;
// The recognizer resolves the newest listen when the test "says" something.
let pendingListen: ((result: UtteranceResult) => void) | null = null;

type ChatApi = ReturnType<typeof useChat>;
type SessionApi = ReturnType<typeof useLoveSession>;
type OpenLove = ReturnType<typeof useOpenLove>;
let chat: ChatApi | null = null;
let session: SessionApi | null = null;
let openLove: OpenLove | null = null;
const Probe = () => {
  chat = useChat();
  session = useLoveSession();
  openLove = useOpenLove();
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
const connect = async () => {
  act(() => {
    jest.advanceTimersByTime(CALL_CONNECT_DELAY_MS + 100);
  });
  await settle();
};

const trees: ReactTestRenderer[] = [];

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
    throw new Error("Sync is not listening");
  }
  act(() => {
    deliver({ ok: true, text, end });
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
  openLove = null;
  mockNavigation = fakeNavigation();
  mockMotorStop.mockClear();
  listenMock.mockReset();
  stopVoice.mockReset();
  ringPlay.mockReset();
  ringPlay.mockResolvedValue(true);
  nativeStop.mockReset();
  nativeStop.mockResolvedValue(undefined);
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

// The hook on its own, the way a screen whose mic control is a mute switch
// (not the call's one-button state machine) drives it.
let voice: VoiceCall | null = null;
const VoiceProbe = (props: Partial<VoiceCallInput>) => {
  voice = useVoiceCall({
    name: "Chad",
    history: [],
    connectDelayMs: 0,
    ...props,
  });
  return null;
};

const mountVoice = async (props: Partial<VoiceCallInput> = {}) => {
  voice = null;
  act(() => {
    trees.push(renderer.create(<VoiceProbe {...props} />));
  });
  await settle();
};

describe("useVoiceCall as a mute switch (Sync's mic control)", () => {
  it("setMuted(true) while listening closes the mic and stops the loop; setMuted(false) opens it again", async () => {
    await saveArkKey();
    await mountVoice();
    expect(voice!.phase).toBe("listening");
    expect(listenMock).toHaveBeenCalledTimes(1);

    act(() => {
      voice!.setMuted(true);
    });
    await settle();

    expect(voice!.muted).toBe(true);
    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(voice!.phase).toBe("ready");
    // Whatever the closed mic still hands back goes nowhere.
    await say("你好 Chad");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);

    act(() => {
      voice!.setMuted(false);
    });
    await settle();
    expect(voice!.muted).toBe(false);
    expect(voice!.phase).toBe("listening");
    expect(listenMock).toHaveBeenCalledTimes(2);
  });

  it("setMuted(true) while the companion speaks lets the line finish and then keeps the mic shut; setMuted(false) listens", async () => {
    // A mute switch is not barge-in: muting is about the user's mic, so the
    // companion is not cut off — but the mic must not open after the line.
    await saveArkKey();
    await mountVoice();
    await say("你好 Chad");
    expect(voice!.phase).toBe("speaking");
    ttsStopMock.mockClear();

    act(() => {
      voice!.setMuted(true);
    });
    await settle();
    expect(voice!.muted).toBe(true);
    expect(ttsStopMock).not.toHaveBeenCalled();
    expect(voice!.phase).toBe("speaking");

    await finishSpeech();
    expect(voice!.phase).toBe("ready");
    expect(listenMock).toHaveBeenCalledTimes(1);

    act(() => {
      voice!.setMuted(false);
    });
    await settle();
    expect(voice!.phase).toBe("listening");
    expect(listenMock).toHaveBeenCalledTimes(2);
  });

  it("setMuted(false) while the companion is still speaking does not interrupt it — the mic opens on its own after the line", async () => {
    await saveArkKey();
    await mountVoice();
    await say("你好 Chad");
    act(() => {
      voice!.setMuted(true);
    });
    await settle();
    ttsStopMock.mockClear();

    act(() => {
      voice!.setMuted(false);
    });
    await settle();
    expect(voice!.muted).toBe(false);
    expect(ttsStopMock).not.toHaveBeenCalled();
    expect(voice!.phase).toBe("speaking");
    expect(listenMock).toHaveBeenCalledTimes(1);

    await finishSpeech();
    expect(voice!.phase).toBe("listening");
    expect(listenMock).toHaveBeenCalledTimes(2);
  });

  it("muted while thinking: the reply is still spoken, then the mic stays shut", async () => {
    await saveArkKey();
    let deliver: ((value: unknown) => void) | null = null;
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        })
    );
    await mountVoice();
    await say("你好 Chad");
    expect(voice!.phase).toBe("thinking");

    act(() => {
      voice!.setMuted(true);
    });
    await settle();
    act(() => {
      deliver?.(arkReply("Still here."));
    });
    await settle();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(voice!.phase).toBe("speaking");

    await finishSpeech();
    expect(voice!.phase).toBe("ready");
    expect(voice!.muted).toBe(true);
    expect(listenMock).toHaveBeenCalledTimes(1);
  });

  it("muted before the companion has greeted: the opener is still spoken, then the mic waits", async () => {
    await mountVoice({ connectDelayMs: CALL_CONNECT_DELAY_MS });
    expect(voice!.phase).toBe("connecting");
    act(() => {
      voice!.setMuted(true);
    });
    await settle();

    await connect();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(voice!.phase).toBe("speaking");
    await finishSpeech();
    expect(voice!.phase).toBe("ready");
    expect(listenMock).not.toHaveBeenCalled();

    act(() => {
      voice!.setMuted(false);
    });
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(voice!.phase).toBe("listening");
  });

  it("speaker off: the next reply is not spoken, stays as text, and the mic opens again at once", async () => {
    await saveArkKey();
    await mountVoice();
    expect(voice!.speakerOn).toBe(true);

    act(() => {
      voice!.setSpeakerOn(false);
    });
    await settle();
    expect(voice!.speakerOn).toBe(false);

    await say("你好 Chad");
    expect(speakMock).not.toHaveBeenCalled();
    expect(voice!.reply).toBe("我在呢。");
    expect(voice!.transcript).toEqual([
      { from: "me", text: "你好 Chad" },
      { from: "them", text: "我在呢。" },
    ]);
    expect(voice!.phase).toBe("listening");
    expect(listenMock).toHaveBeenCalledTimes(2);

    act(() => {
      voice!.setSpeakerOn(true);
    });
    await settle();
    await say("Again");
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(voice!.phase).toBe("speaking");
  });

  it("speaker off in the middle of a line cuts it and the mic opens", async () => {
    await saveArkKey();
    await mountVoice();
    await say("你好 Chad");
    expect(voice!.phase).toBe("speaking");
    ttsStopMock.mockClear();

    act(() => {
      voice!.setSpeakerOn(false);
    });
    await settle();

    expect(ttsStopMock).toHaveBeenCalledTimes(1);
    expect(voice!.phase).toBe("listening");
    expect(listenMock).toHaveBeenCalledTimes(2);
  });

  it("speaker off before connect: the opener shows as text, unspoken, and the mic opens", async () => {
    await mountVoice({ connectDelayMs: CALL_CONNECT_DELAY_MS });
    act(() => {
      voice!.setSpeakerOn(false);
    });
    await connect();

    expect(speakMock).not.toHaveBeenCalled();
    expect(voice!.reply).toContain("Chad");
    expect(voice!.phase).toBe("listening");
    expect(listenMock).toHaveBeenCalledTimes(1);
  });
});

describe("useVoiceCall with a ringtone", () => {
  it("rings for RING_DURATION_MS before the companion greets — the tone plays once, the old 1.6 s connect is not enough", async () => {
    await mountVoice({ connectDelayMs: RING_DURATION_MS, ringtone: true });
    expect(voice!.phase).toBe("connecting");
    expect(ringPlay).toHaveBeenCalledTimes(1);
    expect(ringPlay.mock.calls[0][0]).toEqual([
      ringbackToneWav(RING_DURATION_MS),
    ]);
    expect(speakMock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(CALL_CONNECT_DELAY_MS + 100);
    });
    await settle();
    expect(voice!.phase).toBe("connecting");
    expect(speakMock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(RING_DURATION_MS - CALL_CONNECT_DELAY_MS);
    });
    await settle();
    // The ring is over: the player is silenced, then the greeting.
    expect(nativeStop).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(voice!.phase).toBe("speaking");
    await finishSpeech();
    expect(voice!.phase).toBe("listening");
    expect(ringPlay).toHaveBeenCalledTimes(1);
  });

  it("a connect delay shorter than a ring is stretched to the shortest ring", async () => {
    await mountVoice({ connectDelayMs: CALL_CONNECT_DELAY_MS, ringtone: true });
    act(() => {
      jest.advanceTimersByTime(CALL_CONNECT_DELAY_MS + 100);
    });
    await settle();
    expect(voice!.phase).toBe("connecting");
    act(() => {
      jest.advanceTimersByTime(RING_MIN_MS - CALL_CONNECT_DELAY_MS);
    });
    await settle();
    expect(voice!.phase).toBe("speaking");
  });

  it("hang-up during the ring silences it at once and no greeting ever comes", async () => {
    await saveArkKey();
    await mountVoice({ connectDelayMs: RING_DURATION_MS, ringtone: true });
    act(() => {
      jest.advanceTimersByTime(900);
    });
    await settle();

    act(() => {
      voice!.hangUp();
    });
    await settle();
    expect(nativeStop).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(RING_DURATION_MS * 2);
    });
    await settle();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();
    expect(voice!.phase).toBe("ready");
  });

  it("unmount during the ring (minimize) silences it and nothing runs on after", async () => {
    await saveArkKey();
    await mountVoice({ connectDelayMs: RING_DURATION_MS, ringtone: true });
    act(() => {
      jest.advanceTimersByTime(900);
    });
    await settle();

    act(() => {
      trees.splice(0).forEach((tree) => tree.unmount());
    });
    await settle();
    expect(nativeStop).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(RING_DURATION_MS * 2);
    });
    await settle();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();
  });

  it("an already-running conversation (connectDelayMs 0) never rings", async () => {
    await mountVoice({ connectDelayMs: 0, ringtone: true });
    expect(ringPlay).not.toHaveBeenCalled();
    expect(voice!.phase).toBe("listening");
  });

  it("without the option the calls connect as before: silent, after CALL_CONNECT_DELAY_MS", async () => {
    await mountVoice({ connectDelayMs: CALL_CONNECT_DELAY_MS });
    expect(ringPlay).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(CALL_CONNECT_DELAY_MS + 100);
    });
    await settle();
    expect(ringPlay).not.toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(1);
  });
});

const LOVE_SYNC = String(SCREENS.LOVE_SYNC);

// The stores hydrate at app launch, long before anyone opens Sync: mount the
// providers first and let them settle.
const mountProviders = async () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Providers>{null}</Providers>);
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

const show = async (tree: ReactTestRenderer, screen: ReactNode) => {
  act(() => {
    tree.update(<Providers>{screen}</Providers>);
  });
  await settle();
};

const showLoveSync = async (
  tree: ReactTestRenderer,
  person: { companionId: string; name: string }
) => {
  mockRoute = { name: LOVE_SYNC, params: person };
  await show(tree, <LoveSyncScreen />);
};

// Love chat → + → Sync: the Love chat already has this person and some
// lines; the drawer marks the chat synced and opens the Sync layer over it
// (`src/screens/love/chat.tsx`, the `sync` drawer item).
const chad = { companionId: "chad", name: "Chad" };
const openLoveOriginSync = async () => {
  const tree = await mountProviders();
  act(() => {
    session!.start({
      layer: "chat",
      surface: "love",
      ...chad,
      messages: [
        { kind: "bubble", id: "c1", from: "them", text: "Hey, it's Chad." },
        { kind: "bubble", id: "c2", from: "me", text: "hi Chad, long day" },
      ],
    });
  });
  await settle();
  act(() => {
    session!.patchChat((current) => ({
      ...current,
      synced: true,
      messages: [...current.messages, { kind: "sync", id: "sync-1" }],
    }));
    session!.start({ layer: "sync", ...chad });
  });
  await settle();
  await showLoveSync(tree, chad);
  return tree;
};

// Ring → the companion's opener is spoken → listening.
const connectAndGreet = async () => {
  await connect();
  await finishSpeech();
};

const loveMessages = () => session?.chat?.messages ?? [];

const micButton = (root: ReactTestInstance) => touchable(root, "love-sync-mic");
const speakerButton = (root: ReactTestInstance) =>
  touchable(root, "love-sync-speaker");

const holdControls = (root: ReactTestInstance) =>
  root.findAll((node) => typeof node.props?.onPressIn === "function");

describe("Love Sync voice", () => {
  it("connects, Chad greets first in his own voice grounded in the Love chat, then the mic opens on its own — no tap, no hold", async () => {
    await saveArkKey();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(arkReply("Hey you. Ready?"))
    );
    const tree = await openLoveOriginSync();

    // The ring: nobody is being called, the voice is coming up.
    expect(session).toMatchObject({ layer: "sync", minimized: false });
    expect(session?.chat?.synced).toBe(true);
    expect(typeof session?.syncStartedAt).toBe("number");
    expect(texts(tree.root)).toContain("Syncing");
    expect(texts(tree.root)).toContain(syncStatusLabel({ phase: "connecting", name: "Chad" }));
    expect(texts(tree.root)).not.toContain("Calling Chad");
    expect(listenMock).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();

    await connect();

    // The opener is asked of Ark as Chad, grounded in the Love chat.
    const [body] = arkBodies();
    expect(body.messages[0].content).toContain("You are Chad");
    expect(body.messages.map((m) => m.content)).toContain("hi Chad, long day");
    expect(body.messages[body.messages.length - 1]).toEqual({
      role: "system",
      content: OPENER_INSTRUCTION,
    });
    // Spoken in Chad's (male) voice, expressive, before anyone is asked to talk.
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      text: "Hey you. Ready?",
      voiceId: SEED_VOICES.chad,
      expressive: true,
    });
    expect(voiceById(SEED_VOICES.chad)?.gender).toBe("male");
    expect(texts(tree.root)).toContain("Chad is speaking");
    expect(texts(tree.root)).toContain("Hey you. Ready?");
    expect(texts(tree.root)).toContain("Syncing");
    expect(listenMock).not.toHaveBeenCalled();

    await finishSpeech();

    // Hands-free: the mic opens by itself once he has finished.
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock.mock.calls[0][0]).toMatchObject({
      silenceMs: LISTEN_SILENCE_MS,
      idleMs: LISTEN_IDLE_MS,
    });
    expect(texts(tree.root)).toContain("Listening…");
    expect(holdControls(tree.root)).toHaveLength(0);
    expect(texts(tree.root).join("\n")).not.toMatch(
      /Hold to talk|Tap to talk|Tap to resume/i
    );
  });

  it("without an Ark key Chad still greets with the canned line and Sync shows the Companion AI copy", async () => {
    const tree = await openLoveOriginSync();
    await connect();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      text: localOpener("Chad"),
      voiceId: SEED_VOICES.chad,
    });
    const copy = texts(tree.root).join("\n");
    expect(copy).toMatch(/Companion AI/);
    expect(copy).toMatch(/Add a key/);
    await finishSpeech();
    expect(listenMock).toHaveBeenCalledTimes(1);
  });

  it("a spoken turn is answered as Chad from the Love chat plus what was said on Sync, spoken, then Sync listens again — and nothing is written to the Love chat or his thread", async () => {
    await saveArkKey();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(arkReply("Hey you."))
    );
    const tree = await openLoveOriginSync();
    await connectAndGreet();
    const loveBefore = loveMessages();
    const threadBefore = chat!.getThread("chad")!;

    await say("你好 Chad");

    const [, body] = arkBodies();
    expect(body.model).toBe(ARK_MODEL);
    expect(body.messages[0].content).toContain("You are Chad");
    expect(body.messages.map((m) => m.content)).toContain("hi Chad, long day");
    expect(body.messages.slice(-2)).toEqual([
      { role: "assistant", content: "Hey you." },
      { role: "user", content: "你好 Chad" },
    ]);
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock.mock.calls[1][0]).toMatchObject({
      text: "我在呢。",
      voiceId: SEED_VOICES.chad,
      expressive: true,
    });
    const copy = texts(tree.root);
    expect(copy).toContain("Chad is speaking");
    expect(copy).toContain("你好 Chad");
    expect(copy).toContain("我在呢。");
    // The spoken turn stays on Sync (landmine 26).
    expect(loveMessages()).toEqual(loveBefore);
    expect(loveMessages().map((item) => ("text" in item ? item.text : ""))).not.toContain("你好 Chad");
    const threadAfter = chat!.getThread("chad")!;
    expect(threadAfter.messages).toEqual(threadBefore.messages);
    expect(threadAfter.preview).toBe(threadBefore.preview);
    expect(threadAfter.lastActivityAt).toBe(threadBefore.lastActivityAt);

    await finishSpeech();
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("the mute control really closes the mic: a late utterance goes nowhere, the button reads Unmute, and unmuting listens again", async () => {
    await saveArkKey();
    const tree = await openLoveOriginSync();
    await connectAndGreet();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(micButton(tree.root).props.accessibilityLabel).toBe("Mute");

    press(micButton(tree.root));
    await settle();

    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(micButton(tree.root).props.accessibilityLabel).toBe("Unmute");
    expect(texts(tree.root)).toContain("Connected");
    (global.fetch as jest.Mock).mockClear();
    await say("你好 Chad");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);

    press(micButton(tree.root));
    await settle();
    expect(micButton(tree.root).props.accessibilityLabel).toBe("Mute");
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("muting while Chad speaks does not cut him off; he finishes and the mic stays shut until unmuted", async () => {
    await saveArkKey();
    const tree = await openLoveOriginSync();
    await connectAndGreet();
    await say("你好 Chad");
    expect(texts(tree.root)).toContain("Chad is speaking");
    ttsStopMock.mockClear();

    press(micButton(tree.root));
    await settle();
    expect(ttsStopMock).not.toHaveBeenCalled();
    expect(texts(tree.root)).toContain("Chad is speaking");

    await finishSpeech();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Connected");

    press(micButton(tree.root));
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("speaker off silences Chad: the reply stays on screen as text and the mic reopens at once; speaker on speaks again", async () => {
    await saveArkKey();
    const tree = await openLoveOriginSync();
    await connectAndGreet();
    expect(speakerButton(tree.root).props.accessibilityLabel).toBe(
      "Speaker off"
    );

    press(speakerButton(tree.root));
    await settle();
    expect(speakerButton(tree.root).props.accessibilityLabel).toBe(
      "Speaker on"
    );
    await say("你好 Chad");

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("我在呢。");
    expect(texts(tree.root)).toContain("Listening…");
    expect(listenMock).toHaveBeenCalledTimes(2);

    press(speakerButton(tree.root));
    await settle();
    await say("Again");
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Chad is speaking");
  });

  it("hang-up stops the mic and the voice, clears synced on the chat and his thread, stops the motor and lands on the Love chat; a late utterance is dropped", async () => {
    await saveArkKey();
    const tree = await openLoveOriginSync();
    await connectAndGreet();
    await say("你好 Chad");
    await finishSpeech();
    expect(texts(tree.root)).toContain("Listening…");
    const loveBefore = loveMessages();
    stopVoice.mockClear();
    (global.fetch as jest.Mock).mockClear();

    press(touchable(tree.root, "love-sync-hangup"));
    await settle();

    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(ttsStopMock).toHaveBeenCalled();
    expect(mockMotorStop).toHaveBeenCalled();
    expect(session?.layer).toBe("chat");
    expect(session?.chat?.synced).toBe(false);
    expect(session?.syncStartedAt).toBeNull();
    expect(chat!.getThread("chad")?.synced).toBe(false);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(loveMessages()).toEqual(loveBefore);
    await say("one more thing");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(2);
  });

  it("minimize keeps the session and closes the mic; the pill brings Sync back already on — no ring, no second greeting, listening at once, clock kept", async () => {
    await saveArkKey();
    const tree = await openLoveOriginSync();
    await connectAndGreet();
    await say("你好 Chad");
    await finishSpeech();
    expect(speakMock).toHaveBeenCalledTimes(2);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    await settle();
    const clock = () => texts(tree.root).find((copy) => /^\d\d:\d\d$/.test(copy));
    expect(clock()).toBe("00:06");
    const startedAt = session!.syncStartedAt;

    press(touchable(tree.root, "love-sync-minimize"));
    await settle();
    expect(session).toMatchObject({ layer: "sync", minimized: true, companionId: "chad" });
    expect(session?.chat?.synced).toBe(true);
    expect(mockNavigation.dispatch).toHaveBeenCalled();
    // The overlay is gone; the screen going away closes the mic.
    stopVoice.mockClear();
    await show(tree, null);
    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(session?.syncStartedAt).toBe(startedAt);

    // Pill → restore.
    speakMock.mockClear();
    listenMock.mockClear();
    (global.fetch as jest.Mock).mockClear();
    ttsStopMock.mockClear();
    act(() => {
      session!.restore();
    });
    await showLoveSync(tree, chad);

    expect(texts(tree.root)).not.toContain(
      syncStatusLabel({ phase: "connecting", name: "Chad" })
    );
    expect(speakMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    // Whatever was still being said when the pill took over is cut before
    // the mic opens.
    expect(ttsStopMock).toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Listening…");
    expect(clock()).toBe("00:06");
    expect(session?.syncStartedAt).toBe(startedAt);
  });

  it("Message thread → Sync: Amanda is grounded in her thread, speaks in a woman's voice, her thread is untouched, and hang-up lands back on the chat layer", async () => {
    await saveArkKey();
    const tree = await mountProviders();
    const threadBefore = chat!.getThread("amanda")!;
    act(() => {
      openLove!({ companionId: "amanda", syncing: true, fromMessage: true });
    });
    await settle();
    expect(session).toMatchObject({ layer: "sync", surface: "message" });
    await showLoveSync(tree, { companionId: "amanda", name: "Amanda" });
    await connect();

    const [opener] = arkBodies();
    expect(opener.messages[0].content).toContain("You are Amanda");
    expect(opener.messages.map((m) => m.content)).toContain(
      "Don't act surprised. You always come back."
    );
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      voiceId: SEED_VOICES.amanda,
    });
    expect(voiceById(SEED_VOICES.amanda)?.gender).toBe("female");
    await finishSpeech();
    await say("Hi Amanda");
    expect(speakMock.mock.calls[1][0]).toMatchObject({
      voiceId: SEED_VOICES.amanda,
    });
    await finishSpeech();

    press(touchable(tree.root, "love-sync-hangup"));
    await settle();
    const threadAfter = chat!.getThread("amanda")!;
    expect(threadAfter.messages).toEqual(threadBefore.messages);
    expect(threadAfter.preview).toBe(threadBefore.preview);
    expect(session?.layer).toBe("chat");
    expect(session?.surface).toBe("message");
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("a Control-origin Sync restored from the pill is listening from its first frame; red X ends the session, the mic and the voice", async () => {
    await saveArkKey();
    const tree = await mountProviders();
    // What Control's SyncScreen leaves behind on minimize.
    act(() => {
      session!.start({
        layer: "sync",
        surface: "control",
        companionId: "kevin",
        name: "Kevin",
        syncing: true,
      });
      session!.ensureLayerTimer("sync", Date.now() - 12000);
      session!.minimize();
    });
    await settle();
    act(() => {
      session!.restore();
    });
    await showLoveSync(tree, { companionId: "kevin", name: "Kevin" });

    expect(speakMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Listening…");
    expect(texts(tree.root)).toContain("00:12");
    stopVoice.mockClear();

    press(touchable(tree.root, "love-sync-hangup"));
    await settle();

    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(ttsStopMock).toHaveBeenCalled();
    expect(session?.layer).toBeNull();
    expect(session?.chat).toBeNull();
    expect(mockNavigation.dispatch).toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });
});

// Control hub → Sync card → picker row → SyncScreen inside the SyncStack
// (a plain stack, no Love session yet). `getParent()` is the Home stack.
const SYNC_SCREEN = String(SCREENS.SYNC_SCREEN);
let homeNavigation: FakeNavigation = fakeNavigation();
const openControlSync = async (person: { companionId: string; name: string }) => {
  const tree = await mountProviders();
  homeNavigation = fakeNavigation();
  mockNavigation = fakeNavigation(homeNavigation);
  mockRoute = { name: SYNC_SCREEN, params: person };
  await show(tree, <SyncScreen />);
  return tree;
};

const controlMic = (root: ReactTestInstance) =>
  touchable(root, "control-sync-mic");
const controlSpeaker = (root: ReactTestInstance) =>
  touchable(root, "control-sync-speaker");

const nova: Companion = {
  ...DEFAULT_DRAFT,
  id: "companion-nova",
  name: "Nova",
  birthday: "01/01/2000",
  gender: "Male",
  personalities: ["Playful & whimsical"],
  story: "Made in the avatar wizard.",
};

describe("Control hub Sync voice", () => {
  it("connects, Amanda greets in a woman's voice grounded in her Message thread, then the mic opens on its own — no tap, no hold", async () => {
    await saveArkKey();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(arkReply("There you are."))
    );
    const tree = await openControlSync({ companionId: "amanda", name: "Amanda" });

    expect(texts(tree.root)).toContain("Amanda");
    expect(texts(tree.root)).toContain(
      syncStatusLabel({ phase: "connecting", name: "Amanda" })
    );
    expect(texts(tree.root)).not.toContain("Calling Amanda");
    expect(listenMock).not.toHaveBeenCalled();
    // Control Sync starts no Love session until it is minimized.
    expect(session?.layer).toBeNull();

    await connect();

    const [body] = arkBodies();
    expect(body.messages[0].content).toContain("You are Amanda");
    expect(body.messages.map((m) => m.content)).toContain(
      "Don't act surprised. You always come back."
    );
    expect(body.messages[body.messages.length - 1]).toEqual({
      role: "system",
      content: OPENER_INSTRUCTION,
    });
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({
      text: "There you are.",
      voiceId: SEED_VOICES.amanda,
      expressive: true,
    });
    expect(voiceById(SEED_VOICES.amanda)?.gender).toBe("female");
    expect(texts(tree.root)).toContain("Amanda is speaking");
    expect(listenMock).not.toHaveBeenCalled();

    await finishSpeech();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Listening…");
    expect(holdControls(tree.root)).toHaveLength(0);
    expect(texts(tree.root).join("\n")).not.toMatch(
      /Hold to talk|Tap to talk|Tap to resume/i
    );
  });

  it("a spoken turn is answered as Amanda and spoken; her Message thread is untouched, and Sync listens again", async () => {
    await saveArkKey();
    const tree = await openControlSync({ companionId: "amanda", name: "Amanda" });
    await connectAndGreet();
    const before = chat!.getThread("amanda")!;

    await say("Hi Amanda");

    const [, body] = arkBodies();
    expect(body.messages[0].content).toContain("You are Amanda");
    expect(body.messages[body.messages.length - 1]).toEqual({
      role: "user",
      content: "Hi Amanda",
    });
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock.mock.calls[1][0]).toMatchObject({
      text: "我在呢。",
      voiceId: SEED_VOICES.amanda,
    });
    expect(texts(tree.root)).toContain("Hi Amanda");
    expect(texts(tree.root)).toContain("我在呢。");
    const after = chat!.getThread("amanda")!;
    expect(after.messages).toEqual(before.messages);
    expect(after.preview).toBe(before.preview);
    expect(after.lastActivityAt).toBe(before.lastActivityAt);

    await finishSpeech();
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("a crafted companion is answered as themselves: their personality and story ground the opener, and they speak in a voice of their gender", async () => {
    await saveArkKey();
    await saveCompanions("demo", {
      companions: [nova],
      activeCompanionId: null,
    });
    const tree = await openControlSync({ companionId: nova.id, name: nova.name });
    expect(texts(tree.root)).toContain("Nova");
    await connect();

    const [body] = arkBodies();
    expect(body.messages[0].content).toContain("You are Nova");
    expect(body.messages[0].content).toContain("Playful & whimsical");
    expect(body.messages[0].content).toContain("Made in the avatar wizard.");
    const spoken = speakMock.mock.calls[0][0] as { voiceId?: string };
    expect(voiceById(spoken.voiceId)?.gender).toBe("male");
  });

  it("mute really closes the mic and the button reads Unmute; unmute listens again", async () => {
    await saveArkKey();
    const tree = await openControlSync({ companionId: "kevin", name: "Kevin" });
    await connectAndGreet();
    expect(controlMic(tree.root).props.accessibilityLabel).toBe("Mute");

    press(controlMic(tree.root));
    await settle();
    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(controlMic(tree.root).props.accessibilityLabel).toBe("Unmute");
    (global.fetch as jest.Mock).mockClear();
    await say("你好 Kevin");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);

    press(controlMic(tree.root));
    await settle();
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain("Listening…");
  });

  it("speaker off keeps Kevin's reply on screen unspoken and the mic open", async () => {
    await saveArkKey();
    const tree = await openControlSync({ companionId: "kevin", name: "Kevin" });
    await connectAndGreet();
    expect(controlSpeaker(tree.root).props.accessibilityLabel).toBe(
      "Speaker off"
    );
    press(controlSpeaker(tree.root));
    await settle();
    expect(controlSpeaker(tree.root).props.accessibilityLabel).toBe(
      "Speaker on"
    );

    await say("你好 Kevin");
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("我在呢。");
    expect(texts(tree.root)).toContain("Listening…");
    expect(listenMock).toHaveBeenCalledTimes(2);
  });

  it("red X stops the mic, the voice and the motor and leaves the Sync stack; a late utterance is dropped", async () => {
    await saveArkKey();
    const tree = await openControlSync({ companionId: "kevin", name: "Kevin" });
    await connectAndGreet();
    stopVoice.mockClear();
    (global.fetch as jest.Mock).mockClear();

    press(touchable(tree.root, "control-sync-hangup"));
    await settle();

    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(ttsStopMock).toHaveBeenCalled();
    expect(mockMotorStop).toHaveBeenCalled();
    expect(homeNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(session?.layer).toBeNull();
    await say("one more thing");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);
  });

  it("minimize keeps a Control Sync session with its clock and closes the mic; the pill's LoveSync comes back listening at once with the clock kept", async () => {
    await saveArkKey();
    const tree = await openControlSync({ companionId: "kevin", name: "Kevin" });
    await connectAndGreet();
    await say("你好 Kevin");
    await finishSpeech();
    expect(speakMock).toHaveBeenCalledTimes(2);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    await settle();
    const clock = () => texts(tree.root).find((copy) => /^\d\d:\d\d$/.test(copy));
    expect(clock()).toBe("00:06");

    press(touchable(tree.root, "control-sync-minimize"));
    await settle();
    expect(session).toMatchObject({
      layer: "sync",
      minimized: true,
      surface: "control",
      companionId: "kevin",
    });
    expect(session?.chat?.synced).toBe(true);
    expect(typeof session?.syncStartedAt).toBe("number");
    expect(homeNavigation.goBack).toHaveBeenCalledTimes(1);
    stopVoice.mockClear();
    await show(tree, null);
    expect(stopVoice).toHaveBeenCalledTimes(1);

    speakMock.mockClear();
    listenMock.mockClear();
    (global.fetch as jest.Mock).mockClear();
    act(() => {
      session!.restore();
    });
    mockNavigation = fakeNavigation();
    await showLoveSync(tree, { companionId: "kevin", name: "Kevin" });

    expect(speakMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toContain("Listening…");
    expect(texts(tree.root)).toContain("Kevin");
    expect(clock()).toBe("00:06");
    // Nothing from Sync reached Kevin's thread on the way.
    expect(chat!.getThread("kevin")!.messages.map((m) => m.text)).not.toContain(
      "你好 Kevin"
    );
  });
});

describe("both Sync surfaces run the one voice engine", () => {
  const SYNC_SOURCES = [
    "src/screens/love/sync.tsx",
    "src/screens/sync/sync_screen.tsx",
  ];

  it.each(SYNC_SOURCES)(
    "%s drives useVoiceCall and never opens the mic or the voice on its own",
    (file) => {
      const source = readFileSync(join(__dirname, "..", file), "utf8");
      expect(source).toContain("useVoiceCall(");
      expect(source).toContain("voiceForPerson(");
      // No second engine: speech and TTS are reached only through the hook.
      expect(source).not.toContain("listenForUtterance");
      expect(source).not.toContain("startVoiceInput");
      expect(source).not.toContain("ttsSpeak");
      // The mic control is a switch on the hook's mute, not local state.
      expect(source).not.toMatch(/useState\((false|true)\)/);
    }
  );

  it.each([...SYNC_SOURCES, "src/screens/call/captions.tsx"])(
    "%s has no press-and-hold control and no tap-to-talk copy",
    (file) => {
      const source = readFileSync(join(__dirname, "..", file), "utf8");
      expect(source).not.toContain("onPressIn");
      expect(source).not.toContain("onPressOut");
      expect(source).not.toMatch(/tap[ -]to[ -]talk|hold[ -]to[ -]talk/i);
    }
  );

  it("the Love Sync overlay resolves its person's face and voice, never a stock portrait", () => {
    const source = readFileSync(
      join(__dirname, "../src/screens/love/sync.tsx"),
      "utf8"
    );
    expect(source).not.toContain("faceSourceForId(");
    expect(source).not.toContain("call-face.png");
  });
});

describe("Sync status copy", () => {
  it("nobody is being called on Sync: the ring reads as the voice connecting, every other phase as on a call", () => {
    expect(syncStatusLabel({ phase: "connecting", name: "Kevin" })).toBe(
      "Connecting…"
    );
    expect(syncStatusLabel({ phase: "connecting", name: "Kevin" })).not.toMatch(
      /Calling/
    );
    CALL_PHASES.filter((phase) => phase !== "connecting").forEach((phase) => {
      expect(syncStatusLabel({ phase, name: "Kevin" })).toBe(
        callStatusLabel({ phase, name: "Kevin" })
      );
    });
    CALL_PHASES.forEach((phase) => {
      expect(syncStatusLabel({ phase, name: "Kevin" })).not.toMatch(
        /tap to talk|hold to talk|to talk/i
      );
    });
  });
});
