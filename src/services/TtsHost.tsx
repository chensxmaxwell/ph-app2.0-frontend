import { useEffect } from "react";
import { loadLlmConfig } from "./llm-config";
import { createSpeechEngine } from "./speech-engine";
import { configureTtsEngine } from "./tts";
import { ttsCredentialsFromConfig } from "./tts-config";
import { createCloudSynthesizer } from "./tts-provider";
import {
  playAudioWithNative,
  speakWithNativeTts,
  stopNativeTts,
} from "./voice-input";

/**
 * The companion's voice: a cloud voice in the speaker assigned to the person
 * (see voices.ts) — MiniMax speech-2.8-hd when a MiniMax key is saved, else
 * Doubao Seed-TTS 2.0 with the speech-console key — played by PHNative's
 * AVAudioPlayer; when no cloud is configured or reachable, AVSpeechSynthesizer
 * in an on-device voice of the same gender. Both go through PHNative, which
 * moves AVAudioSession back to a playback category first (landmine 22).
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
        synthesize: createCloudSynthesizer(),
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
