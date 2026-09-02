import { useEffect } from "react";
import { configureTtsEngine } from "./tts";
import { speakWithNativeTts, stopNativeTts } from "./voice-input";

/**
 * Listen uses AVSpeechSynthesizer via PHNative.
 * Do not mount a hidden web speech host: that grabbed AVAudioSession
 * at launch and keyboard voice input then killed TestFlight builds.
 */
export const TtsHost = () => {
  useEffect(() => {
    configureTtsEngine({
      speak: async ({ text }) => {
        await speakWithNativeTts(text);
      },
      stop: async () => {
        await stopNativeTts();
      },
    });
    return () => {
      configureTtsEngine({
        speak: async () => undefined,
        stop: async () => undefined,
      });
    };
  }, []);

  return null;
};
