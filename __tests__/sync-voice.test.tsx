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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { writeSessionUser } from "../src/backend/session";
import {
  ARK_BASE_URL,
  ARK_MODEL,
  saveLlmConfig,
} from "../src/services/llm-config";
import { configureTtsEngine } from "../src/services/tts";
import {
  listenForUtterance,
  stopVoiceInput,
  UtteranceEnd,
  UtteranceResult,
} from "../src/services/voice-input";
import { CompanionsProvider } from "../src/store/companions";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import {
  LoveSessionProvider,
  useLoveSession,
} from "../src/screens/love/session";
import { clearLoveSessionBoot } from "../src/screens/love/session-persist";
import {
  CALL_CONNECT_DELAY_MS,
  useVoiceCall,
  VoiceCall,
  VoiceCallInput,
} from "../src/screens/call/use-voice-call";
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
// The recognizer resolves the newest listen when the test "says" something.
let pendingListen: ((result: UtteranceResult) => void) | null = null;

type ChatApi = ReturnType<typeof useChat>;
type SessionApi = ReturnType<typeof useLoveSession>;
let chat: ChatApi | null = null;
let session: SessionApi | null = null;
const Probe = () => {
  chat = useChat();
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
  mockMotorStop.mockClear();
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
