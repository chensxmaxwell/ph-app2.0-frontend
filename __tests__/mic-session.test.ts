import { describe, expect, it } from "@jest/globals";
import {
  MIC_ERROR_MESSAGES,
  startMicSession,
  stopMicSession,
} from "../src/services/mic-session";

describe("startMicSession", () => {
  it("does not start recording when Android permission is denied", async () => {
    const startRecorder = jest.fn(async () => "ok");
    const result = await startMicSession({
      platform: "android",
      requestAndroidAudio: async () => false,
      startRecorder,
    });

    expect(startRecorder).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      reason: "permission-denied",
      message: MIC_ERROR_MESSAGES["permission-denied"],
    });
  });

  it("starts recording on iOS and lets the system show the mic prompt", async () => {
    const startRecorder = jest.fn(async () => "ok");
    const result = await startMicSession({
      platform: "ios",
      startRecorder,
    });

    expect(startRecorder).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("returns an inline error when the native recorder is missing", async () => {
    const result = await startMicSession({
      platform: "ios",
      startRecorder: async () => {
        throw new Error("Cannot read property 'startRecorder' of null");
      },
    });

    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      message: MIC_ERROR_MESSAGES.unavailable,
    });
  });

  it("returns an inline error when permission is denied at start time", async () => {
    const result = await startMicSession({
      platform: "ios",
      startRecorder: async () => {
        throw new Error("Recording permission denied");
      },
    });

    expect(result).toEqual({
      ok: false,
      reason: "permission-denied",
      message: MIC_ERROR_MESSAGES["permission-denied"],
    });
  });

  it("swallows stop errors so teardown cannot crash", async () => {
    await expect(
      stopMicSession(async () => {
        throw new Error("already stopped");
      })
    ).resolves.toBeUndefined();
  });
});
