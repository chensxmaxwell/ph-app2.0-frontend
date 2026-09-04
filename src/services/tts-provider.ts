import { synthesizeSpeech } from "./cloud-tts";
import { createMiniMaxSynthesizer } from "./minimax-tts";
import type { SpeechEngineDeps } from "./speech-engine";

// One engine, two clouds: the saved credentials say which one a reply goes
// to. MiniMax when its key is saved (tts-config puts it first), else Doubao
// Seed-TTS with the speech-console key or the legacy app pair (or the Ark
// best effort). What comes back is base64 audio for the native player either
// way; the on-device fallback is the engine's, not the provider's.
export const createCloudSynthesizer = ({
  fetchImpl = fetch,
}: { fetchImpl?: typeof fetch } = {}): SpeechEngineDeps["synthesize"] => {
  const minimax = createMiniMaxSynthesizer({ fetchImpl });
  return async (input) => {
    const { credentials } = input;
    switch (credentials.kind) {
      case "minimax":
        return minimax({
          text: input.text,
          voiceId: input.voiceId,
          credentials,
          signal: input.signal,
        });
      case "api-key":
      case "app":
        return synthesizeSpeech({
          text: input.text,
          voiceId: input.voiceId,
          credentials,
          signal: input.signal,
          expressive: input.expressive,
          fetchImpl,
        });
      default: {
        const exhaustive: never = credentials;
        return exhaustive;
      }
    }
  };
};
