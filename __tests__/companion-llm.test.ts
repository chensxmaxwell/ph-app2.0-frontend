import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { writeSessionUser } from "../src/backend/session";
import { STORE_KEYS, scopedKey } from "../src/backend/session";
import {
  ARK_BASE_URL,
  ARK_MODEL,
  defaultLlmConfig,
  hasLlmKey,
  loadLlmConfig,
  saveLlmConfig,
} from "../src/services/llm-config";
import {
  CompanionChatError,
  companionChatErrorMessage,
  completeCompanionChat,
} from "../src/services/llm";
import { companionReply } from "../src/screens/love/replies";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const kevinInput = {
  name: "Kevin",
  userText: "hey there",
  history: [] as { from: "me" | "them"; text: string }[],
  personality: "Playful, attentive, a little mischievous.",
  story: "Kevin is playful.",
};

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });

describe("companion LLM config", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await writeSessionUser(null);
  });

  it("defaults to Volcengine Ark URL and model with no baked-in key", () => {
    const defaults = defaultLlmConfig();
    expect(defaults.baseUrl).toBe(ARK_BASE_URL);
    expect(defaults.model).toBe(ARK_MODEL);
    expect(defaults.baseUrl).toBe("https://ark.cn-beijing.volces.com/api/v3");
    expect(defaults.model).toBe("deepseek-v4-flash-ga-260731");
    expect(defaults.apiKey).toBe("");
    expect(hasLlmKey(defaults)).toBe(false);
  });

  it("persists the key for the signed-in account and restores it after reload", async () => {
    await writeSessionUser({
      id: "demo",
      email: "demo@local",
      token: "local.demo",
    });
    await saveLlmConfig({
      apiKey: "ark-test-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });

    const stored = await AsyncStorage.getItem(scopedKey(STORE_KEYS.llm, "demo"));
    expect(stored).toContain("ark-test-key");
    expect(await AsyncStorage.getItem("ph.llm.v1")).toBeNull();

    const loaded = await loadLlmConfig();
    expect(loaded).toEqual({
      apiKey: "ark-test-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });
  });

  it("keeps Companion AI keys isolated across on-device accounts", async () => {
    await writeSessionUser({
      id: "demo",
      email: "demo@local",
      token: "local.demo",
    });
    await saveLlmConfig({
      apiKey: "demo-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });

    await writeSessionUser({
      id: "bypass",
      email: "bypass@local",
      token: "bypass",
    });
    expect(await loadLlmConfig()).toMatchObject({ apiKey: "" });

    await saveLlmConfig({
      apiKey: "bypass-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });

    await writeSessionUser({
      id: "demo",
      email: "demo@local",
      token: "local.demo",
    });
    expect(await loadLlmConfig()).toMatchObject({ apiKey: "demo-key" });
    expect(
      await AsyncStorage.getItem(scopedKey(STORE_KEYS.llm, "bypass"))
    ).toContain("bypass-key");
    expect(
      await AsyncStorage.getItem(scopedKey(STORE_KEYS.llm, "demo"))
    ).not.toContain("bypass-key");
  });

  it("migrates a legacy global key into the current account store", async () => {
    await AsyncStorage.setItem(
      "ph.llm.v1",
      JSON.stringify({
        apiKey: "legacy-key",
        baseUrl: ARK_BASE_URL,
        model: ARK_MODEL,
      })
    );
    await writeSessionUser({
      id: "demo",
      email: "demo@local",
      token: "local.demo",
    });

    const loaded = await loadLlmConfig();
    expect(loaded.apiKey).toBe("legacy-key");
    expect(await AsyncStorage.getItem(scopedKey(STORE_KEYS.llm, "demo"))).toContain(
      "legacy-key"
    );
    expect(await AsyncStorage.getItem("ph.llm.v1")).toBeNull();

    await writeSessionUser({
      id: "bypass",
      email: "bypass@local",
      token: "bypass",
    });
    expect(await loadLlmConfig()).toMatchObject({ apiKey: "" });
  });
});

describe("companion chat send path", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await AsyncStorage.clear();
    await writeSessionUser({
      id: "demo",
      email: "demo@local",
      token: "local.demo",
    });
    global.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws a missing-key error instead of a canned Kevin line", async () => {
    await expect(completeCompanionChat(kevinInput)).rejects.toMatchObject({
      name: "CompanionChatError",
      code: "missing_key",
    });
    expect(global.fetch).not.toHaveBeenCalled();

    try {
      await completeCompanionChat(kevinInput);
    } catch (error) {
      const message = companionChatErrorMessage(error);
      expect(message).toMatch(/Companion AI settings/i);
      expect(message).not.toBe(companionReply("Kevin", "hey there"));
    }
  });

  it("POSTs to Ark with the saved key, URL, and model", async () => {
    await saveLlmConfig({
      apiKey: "ark-device-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });
    (global.fetch as jest.Mock).mockImplementation(() =>
      jsonResponse({
        choices: [{ message: { content: "I'm here with you, for real." } }],
      })
    );

    const reply = await completeCompanionChat(kevinInput);
    expect(reply).toBe("I'm here with you, for real.");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${ARK_BASE_URL}/chat/completions`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer ark-device-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe(ARK_MODEL);
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: "hey there",
    });
  });

  it("does not invent a canned Kevin reply when the key is refused", async () => {
    await saveLlmConfig({
      apiKey: "bad-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });
    (global.fetch as jest.Mock).mockImplementation(() =>
      jsonResponse({ error: { message: "Unauthorized" } }, 401)
    );

    await expect(completeCompanionChat(kevinInput)).rejects.toBeInstanceOf(
      CompanionChatError
    );
    try {
      await completeCompanionChat(kevinInput);
    } catch (error) {
      const message = companionChatErrorMessage(error);
      expect(message).toMatch(/Companion AI settings/i);
      expect(message).not.toMatch(/Hey — it's Kevin/);
      expect(message).not.toBe(companionReply("Kevin", "hey there"));
    }
  });

  it("does not treat an empty model body as a successful Kevin line", async () => {
    await saveLlmConfig({
      apiKey: "ark-device-key",
      baseUrl: ARK_BASE_URL,
      model: ARK_MODEL,
    });
    (global.fetch as jest.Mock).mockImplementation(() =>
      jsonResponse({ choices: [{ message: { content: "   " } }] })
    );

    await expect(completeCompanionChat(kevinInput)).rejects.toMatchObject({
      code: "empty_reply",
    });
  });
});
