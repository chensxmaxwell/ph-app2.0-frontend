import React from "react";
import { Text, TextInput, TouchableOpacity } from "react-native";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
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
import { nativePlayAudio, nativeSpeak } from "../src/native/ph-native";
import { loadLlmConfig, saveLlmConfig } from "../src/services/llm-config";
import { MINIMAX_CN_URL } from "../src/services/minimax-tts";
import { MINIMAX_SEED_VOICES } from "../src/services/minimax-voices";
import { ttsCredentialsFromConfig } from "../src/services/tts-config";
import { ttsSpeak } from "../src/services/tts";
import { TtsHost } from "../src/services/TtsHost";
import { SEED_VOICES } from "../src/services/voices";
import { CompanionAiScreen } from "../src/screens/profile/CompanionAi";

/**
 * The cloud voice needs a 豆包语音 (speech console) API key, which is not the
 * Ark key. Profile → Companion AI is where keys are pasted on the phone, so
 * it takes the voice key too and the TTS engine reads it back. With that key
 * saved the happy path is Doubao Seed-TTS 2.0 through the native player;
 * AVSpeechSynthesizer is only what a phone without a key gets.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("../src/native/ph-native", () => ({
  nativeSpeak: jest.fn(async () => true),
  nativeStopSpeaking: jest.fn(async () => undefined),
  nativePlayAudio: jest.fn(async () => true),
  nativeStartVoiceInput: jest.fn(),
  nativeStopVoiceInput: jest.fn(),
  nativeListenForUtterance: jest.fn(),
}));
jest.mock("react-native-linear-gradient", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View };
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ name: "CompanionAi", params: undefined }),
  useIsFocused: () => true,
}));

const flush = async () => {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};
const settle = () => act(flush);
const trees: ReactTestRenderer[] = [];

beforeEach(async () => {
  await AsyncStorage.clear();
  await writeSessionUser({ id: "demo", email: "demo@local", token: "t" });
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
});

const input = (tree: ReactTestRenderer, testID: string) => {
  const match = tree.root
    .findAllByType(TextInput)
    .find((node) => node.props.testID === testID);
  if (!match) {
    throw new Error(`No TextInput with testID ${testID}`);
  }
  return match;
};

describe("Companion AI voice key", () => {
  it("round-trips through the saved config and is what the TTS engine uses", async () => {
    await saveLlmConfig({
      apiKey: "ark",
      baseUrl: "",
      model: "",
      ttsApiKey: "  speech-key  ",
    });
    const loaded = await loadLlmConfig();
    expect(loaded.ttsApiKey).toBe("speech-key");
    expect(ttsCredentialsFromConfig(loaded)).toEqual({
      kind: "api-key",
      apiKey: "speech-key",
      source: "tts",
    });
    // Without a speech key the Ark key is tried, as a best effort.
    await saveLlmConfig({ apiKey: "ark", baseUrl: "", model: "" });
    expect(ttsCredentialsFromConfig(await loadLlmConfig())).toEqual({
      kind: "api-key",
      apiKey: "ark",
      source: "ark",
    });
  });

  it("with the Voice key saved, a reply is Doubao Seed-TTS 2.0 in the person's speaker through the native player — never AVSpeech", async () => {
    const playAudio = nativePlayAudio as jest.Mock<typeof nativePlayAudio>;
    const speakOnDevice = nativeSpeak as jest.Mock<typeof nativeSpeak>;
    playAudio.mockClear();
    speakOnDevice.mockClear();
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ code: 0, data: "QUJD" }) +
        JSON.stringify({ code: 20000000, message: "OK", data: null }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await saveLlmConfig({
        apiKey: "ark-key",
        baseUrl: "",
        model: "",
        ttsApiKey: "speech-key",
      });
      let tree: ReactTestRenderer;
      act(() => {
        tree = renderer.create(<TtsHost />);
      });
      trees.push(tree!);
      await settle();

      await act(async () => {
        await ttsSpeak({
          id: "k1",
          text: "Hey you. Took you long enough.",
          voiceId: SEED_VOICES.kevin,
        });
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        { headers: Record<string, string>; body: string }
      ];
      expect(url).toBe(
        "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
      );
      expect(init.headers["X-Api-Key"]).toBe("speech-key");
      expect(init.headers["X-Api-Resource-Id"]).toBe("seed-tts-2.0");
      const body = JSON.parse(init.body) as {
        req_params: { speaker: string; text: string };
      };
      expect(body.req_params.speaker).toBe("zh_male_m191_uranus_bigtts");
      expect(body.req_params.text).toBe("Hey you. Took you long enough.");
      expect(playAudio).toHaveBeenCalledWith(["QUJD"]);
      expect(speakOnDevice).not.toHaveBeenCalled();

      // No speech key at all: the phone's own voice, of Kevin's gender, and
      // no Doubao request.
      fetchMock.mockClear();
      playAudio.mockClear();
      await saveLlmConfig({ apiKey: "", baseUrl: "", model: "" });
      await act(async () => {
        await ttsSpeak({
          id: "k2",
          text: "Still here.",
          voiceId: SEED_VOICES.kevin,
        });
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(playAudio).not.toHaveBeenCalled();
      expect(speakOnDevice).toHaveBeenCalledWith("Still here.", {
        gender: "male",
        language: "en-US",
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("a MiniMax key round-trips through the saved config and is preferred over the Doubao key", async () => {
    await saveLlmConfig({
      apiKey: "ark",
      baseUrl: "",
      model: "",
      ttsApiKey: "speech-key",
      minimaxApiKey: "  sk-api-minimax  ",
    });
    const loaded = await loadLlmConfig();
    expect(loaded.minimaxApiKey).toBe("sk-api-minimax");
    expect(loaded.ttsApiKey).toBe("speech-key");
    expect(ttsCredentialsFromConfig(loaded)).toEqual({
      kind: "minimax",
      apiKey: "sk-api-minimax",
    });
    // Cleared again: back to Doubao.
    await saveLlmConfig({ ...loaded, minimaxApiKey: "" });
    const cleared = await loadLlmConfig();
    expect(cleared.minimaxApiKey).toBeUndefined();
    expect(ttsCredentialsFromConfig(cleared)).toEqual({
      kind: "api-key",
      apiKey: "speech-key",
      source: "tts",
    });
  });

  it("with a MiniMax key saved, a reply (call, Sync or Listen — one engine) is MiniMax speech-2.8-hd in the person's MiniMax voice, Doubao is not asked, and the key never leaves the Authorization header", async () => {
    const playAudio = nativePlayAudio as jest.Mock<typeof nativePlayAudio>;
    const speakOnDevice = nativeSpeak as jest.Mock<typeof nativeSpeak>;
    playAudio.mockClear();
    speakOnDevice.mockClear();
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: { audio: "fffb9064", status: 2 },
          base_resp: { status_code: 0, status_msg: "success" },
        }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await saveLlmConfig({
        apiKey: "ark-key",
        baseUrl: "",
        model: "",
        ttsApiKey: "speech-key",
        minimaxApiKey: "sk-api-minimax",
      });
      let tree: ReactTestRenderer;
      act(() => {
        tree = renderer.create(<TtsHost />);
      });
      trees.push(tree!);
      await settle();

      await act(async () => {
        await ttsSpeak({
          id: "a1",
          text: "我在呢。",
          voiceId: SEED_VOICES.amanda,
          expressive: true,
        });
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        { headers: Record<string, string>; body: string }
      ];
      expect(url).toBe(MINIMAX_CN_URL);
      expect(init.headers.Authorization).toBe("Bearer sk-api-minimax");
      expect(init.headers["X-Api-Key"]).toBeUndefined();
      expect(init.body).not.toContain("sk-api-minimax");
      expect(init.body).not.toContain("speech-key");
      const body = JSON.parse(init.body) as {
        model: string;
        text: string;
        voice_setting: { voice_id: string };
      };
      expect(body.model).toBe("speech-2.8-hd");
      expect(body.text).toBe("我在呢。");
      expect(body.voice_setting.voice_id).toBe(MINIMAX_SEED_VOICES.amanda);
      // Hex from MiniMax, base64 to the native player.
      expect(playAudio).toHaveBeenCalledWith([
        Buffer.from("fffb9064", "hex").toString("base64"),
      ]);
      expect(speakOnDevice).not.toHaveBeenCalled();

      // Listen (no `expressive`) speaks through the same door.
      fetchMock.mockClear();
      await act(async () => {
        await ttsSpeak({
          id: "l1",
          text: "Hey you.",
          voiceId: SEED_VOICES.kevin,
        });
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [listenUrl, listenInit] = fetchMock.mock.calls[0] as unknown as [
        string,
        { body: string }
      ];
      expect(listenUrl).toBe(MINIMAX_CN_URL);
      expect(
        (
          JSON.parse(listenInit.body) as {
            voice_setting: { voice_id: string };
          }
        ).voice_setting.voice_id
      ).toBe(MINIMAX_SEED_VOICES.kevin);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("the screen offers a MiniMax key field, masked, and Save persists it beside the Doubao key", async () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<CompanionAiScreen />);
    });
    trees.push(tree!);
    await settle();

    const field = input(tree!, "companion-ai-minimax-key");
    expect(field.props.secureTextEntry).toBe(true);
    expect(input(tree!, "companion-ai-tts-key").props.secureTextEntry).toBe(
      true
    );
    act(() => {
      field.props.onChangeText("sk-api-minimax");
      input(tree!, "companion-ai-tts-key").props.onChangeText("speech-key");
    });
    const save = tree!.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.testID === "companion-ai-save");
    await act(async () => {
      await save!.props.onPress();
    });
    await settle();

    const saved = await loadLlmConfig();
    expect(saved.minimaxApiKey).toBe("sk-api-minimax");
    expect(saved.ttsApiKey).toBe("speech-key");
    // The copy says which voice wins.
    const copy = tree!.root
      .findAllByType(Text)
      .map((node) => React.Children.toArray(node.props.children).join(""))
      .join("\n");
    expect(copy).toMatch(/MiniMax/);
    expect(copy).toMatch(/preferred|first|wins/i);
  });

  it("the screen offers a Voice key field and Save persists it", async () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<CompanionAiScreen />);
    });
    trees.push(tree!);
    await settle();

    act(() => {
      input(tree!, "companion-ai-tts-key").props.onChangeText("speech-key");
    });
    const save = tree!.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.testID === "companion-ai-save");
    expect(save).toBeDefined();
    await act(async () => {
      await save!.props.onPress();
    });
    await settle();

    expect((await loadLlmConfig()).ttsApiKey).toBe("speech-key");
  });
});
