import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

// Voice call: mic + on-device speech recognition. Video call: front camera.
// iOS kills the process on first use of a capability with no usage string.
const REQUIRED_IOS_VOICE_KEYS = [
  "NSMicrophoneUsageDescription",
  "NSSpeechRecognitionUsageDescription",
  "NSCameraUsageDescription",
] as const;

const plistPath = (...parts: string[]) =>
  path.join(__dirname, "..", "ios", ...parts);

const readPlist = (relative: string) =>
  fs.readFileSync(plistPath(relative), "utf8");

const plistStringValue = (plist: string, key: string) => {
  const match = plist.match(
    new RegExp(`<key>${key}</key>\\s*<string>([\\s\\S]*?)</string>`)
  );
  return match ? match[1].trim() : null;
};

describe("iOS voice and video call privacy usage strings", () => {
  it.each(["AppFrontend/Info.plist", "AppFrontendTests/Info.plist"])(
    "keeps non-empty mic, speech-recognition and camera strings in %s",
    (relative) => {
      const plist = readPlist(relative);
      for (const key of REQUIRED_IOS_VOICE_KEYS) {
        const value = plistStringValue(plist, key);
        expect({ key, value }).toEqual({
          key,
          value: expect.any(String),
        });
        expect(value && value.length > 8).toBe(true);
      }
    }
  );
});
