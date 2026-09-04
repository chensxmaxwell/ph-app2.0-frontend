import fs from "fs";
import path from "path";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  nativeListenForUtterance,
  nativeSpeak,
  nativeStartVoiceInput,
  nativeStopSpeaking,
  nativeStopVoiceInput,
} from "../src/native/ph-native";
import {
  listenForUtterance,
  speakWithNativeTts,
  startVoiceInput,
  stopNativeTts,
  stopVoiceInput,
} from "../src/services/voice-input";
import { sanitizeComposerText } from "../src/services/dictation-text";
import { enterTalkMode, leaveTalkMode } from "../src/screens/chat/talk-mode";

jest.mock("../src/native/ph-native", () => ({
  nativeStartVoiceInput: jest.fn(),
  nativeStopVoiceInput: jest.fn(),
  nativeListenForUtterance: jest.fn(),
  nativeSpeak: jest.fn(),
  nativeStopSpeaking: jest.fn(),
}));

const startMock = nativeStartVoiceInput as jest.Mock;
const stopMock = nativeStopVoiceInput as jest.Mock;
const listenMock = nativeListenForUtterance as jest.Mock<
  typeof nativeListenForUtterance
>;
const speakMock = nativeSpeak as jest.Mock;
const stopSpeakMock = nativeStopSpeaking as jest.Mock;

describe("voice input safety", () => {
  beforeEach(() => {
    startMock.mockReset();
    stopMock.mockReset();
    listenMock.mockReset();
    speakMock.mockReset();
    stopSpeakMock.mockReset();
  });

  it("hands-free listening returns the utterance and how it ended", async () => {
    listenMock.mockResolvedValueOnce({
      ok: true,
      text: "你好",
      end: "utterance",
    });
    await expect(
      listenForUtterance({ silenceMs: 1100, maxMs: 20000, idleMs: 45000 })
    ).resolves.toEqual({ ok: true, text: "你好", end: "utterance" });
    expect(listenMock).toHaveBeenCalledWith({
      silenceMs: 1100,
      maxMs: 20000,
      idleMs: 45000,
    });
    // A native side that predates `end` still reads as a finished utterance.
    listenMock.mockResolvedValueOnce({ ok: true, text: "" });
    await expect(listenForUtterance()).resolves.toEqual({
      ok: true,
      text: "",
      end: "utterance",
    });
  });

  it("hands-free listening reports a build without the native method instead of throwing", async () => {
    listenMock.mockRejectedValueOnce(new Error("native down"));
    await expect(listenForUtterance()).resolves.toEqual({
      ok: false,
      reason: "unavailable",
      message: "Voice input is not available on this build.",
    });
    listenMock.mockResolvedValueOnce({
      ok: false,
      reason: "permission-denied",
      message: "Microphone access is needed to use voice input.",
    });
    await expect(listenForUtterance()).resolves.toEqual({
      ok: false,
      reason: "permission-denied",
      message: "Microphone access is needed to use voice input.",
    });
  });

  it("strips iOS dictation placeholder characters", () => {
    expect(sanitizeComposerText("hello\uFFFCthere")).toBe("hellothere");
  });

  it("blurs and dismisses the keyboard before talk mode uncovers the hold button", () => {
    const dismissKeyboard = jest.fn();
    const blurInput = jest.fn();
    const setDrawerOpen = jest.fn();
    const setTalkMode = jest.fn();
    enterTalkMode({ dismissKeyboard, blurInput, setDrawerOpen, setTalkMode });
    expect(blurInput).toHaveBeenCalled();
    expect(dismissKeyboard).toHaveBeenCalled();
    expect(setDrawerOpen).toHaveBeenCalledWith(false);
    expect(setTalkMode).toHaveBeenCalledWith(true);
  });

  it("returns an inline error when native start throws", async () => {
    startMock.mockRejectedValueOnce(new Error("native down"));
    await expect(startVoiceInput()).resolves.toEqual({
      ok: false,
      reason: "unavailable",
      message: "Voice input is not available on this build.",
    });
  });

  it("returns permission denial from native without throwing", async () => {
    startMock.mockResolvedValueOnce({
      ok: false,
      reason: "permission-denied",
      message: "Microphone access is needed to use voice input.",
    });
    await expect(startVoiceInput()).resolves.toEqual({
      ok: false,
      reason: "permission-denied",
      message: "Microphone access is needed to use voice input.",
      text: "",
    });
  });

  it("returns transcript text on stop", async () => {
    stopMock.mockResolvedValueOnce({ ok: true, text: "你好" });
    await expect(stopVoiceInput()).resolves.toEqual({
      ok: true,
      text: "你好",
    });
  });

  it("swallows TTS failures so Listen cannot kill the process", async () => {
    speakMock.mockRejectedValueOnce(new Error("no synth"));
    stopSpeakMock.mockRejectedValueOnce(new Error("already stopped"));
    await expect(speakWithNativeTts("hi")).resolves.toBeUndefined();
    await expect(stopNativeTts()).resolves.toBeUndefined();
  });

  it("clears hold state when leaving talk mode", () => {
    const setTalkMode = jest.fn();
    const setHolding = jest.fn();
    leaveTalkMode({ setTalkMode, setHolding });
    expect(setHolding).toHaveBeenCalledWith(false);
    expect(setTalkMode).toHaveBeenCalledWith(false);
  });

  it("does not keep a WKWebView speechSynthesis host in the tree", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../src/services/TtsHost.tsx"),
      "utf8"
    );
    expect(source).not.toContain("react-native-webview");
    expect(source).toContain("return null");
  });

  it("patches the recorder so dictation interruptions do not pause a nil recorder", () => {
    const patch = fs.readFileSync(
      path.join(
        __dirname,
        "../patches/react-native-audio-recorder-player+3.6.12.patch"
      ),
      "utf8"
    );
    expect(patch).toContain("Idle interruptions from dictation");
    expect(patch).toContain("-            pauseRecorder");
  });
});
