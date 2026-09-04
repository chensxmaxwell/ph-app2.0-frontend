import { useEffect } from "react";
import { synthesizeSpeech } from "./cloud-tts";
import { loadLlmConfig } from "./llm-config";
import { createSpeechEngine } from "./speech-engine";
import { configureTtsEngine } from "./tts";
import { ttsCredentialsFromConfig } from "./tts-config";
import {
  playAudioWithNative,
  speakWithNativeTts,
  stopNativeTts,
} from "./voice-input";

/**
 * The companion's voice: Doubao Seed-TTS 2.0 in the speaker assigned to the
 * person (see voices.ts), played by PHNative's AVAudioPlayer; when the cloud
 * is not reachable, AVSpeechSynthesizer in an on-device voice of the same
 * gender. Both go through PHNative, which moves AVAudioSession back to a
 * playback category first (landmine 22).
 *
 * Do not mount a hidden web speech host: that grabbed AVAudioSession at
 * launch and keyboard voice input then killed TestFlight builds.
 */
export const TtsHost = () => {
  useEffect(() => {
    configureTtsEngine(
      createSpeechEngine({
        loadCredentials: async () =>
          ttsCredentialsFromConfig(await loadLlmConfig()),
        synthesize: synthesizeSpeech,
        playAudio: playAudioWithNative,
        speakOnDevice: speakWithNativeTts,
        stopOnDevice: stopNativeTts,
      })
    );
    return () => {
      configureTtsEngine({
        speak: async () => undefined,
        stop: async () => undefined,
      });
    };
  }, []);

  return null;
};
