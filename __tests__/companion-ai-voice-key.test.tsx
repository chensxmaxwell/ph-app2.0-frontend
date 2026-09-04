import React from "react";
import { TextInput, TouchableOpacity } from "react-native";
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
import { loadLlmConfig, saveLlmConfig } from "../src/services/llm-config";
import { ttsCredentialsFromConfig } from "../src/services/tts-config";
import { CompanionAiScreen } from "../src/screens/profile/CompanionAi";

/**
 * The cloud voice needs a 豆包语音 (speech console) API key, which is not the
 * Ark key. Profile → Companion AI is where keys are pasted on the phone, so
 * it takes the voice key too and the TTS engine reads it back.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
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
