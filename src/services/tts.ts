export type TtsSpeakInput = {
  id: string;
  text: string;
  voiceId?: string;
};

export type TtsEngine = {
  speak: (input: TtsSpeakInput) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking?: () => boolean;
};

/**
 * Default engine is wired by TtsHost (device speech synthesis).
 * Call configureTtsEngine() later with the real TTS API.
 *
 * Expected shape:
 *   configureTtsEngine({
 *     speak: async ({ text, voiceId }) => { await fetch(YOUR_TTS_URL, ...) },
 *     stop: async () => { ... },
 *   })
 */
const stubEngine: TtsEngine = {
  speak: async () => undefined,
  stop: async () => undefined,
  isSpeaking: () => false,
};

let engine: TtsEngine = stubEngine;

export const configureTtsEngine = (next: TtsEngine) => {
  engine = next;
};

export const ttsSpeak = (input: TtsSpeakInput) => engine.speak(input);

export const ttsStop = () => engine.stop();
