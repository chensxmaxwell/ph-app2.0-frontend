import type { SynthesisResult } from "./cloud-tts";
import { splitForSynthesis } from "./cloud-tts";
import type { TtsCredentials } from "./tts-config";
import type { TtsEngine, TtsSpeakInput } from "./tts";
import { VoiceGender, voiceById } from "./voices";

export type DeviceSpeakOptions = {
  gender: VoiceGender | undefined;
  // BCP-47 tag for the on-device voice; the cloud speakers read 中英混 on
  // their own, the device ones need to be told.
  language: "zh-CN" | "en-US";
};

export type SpeechEngineDeps = {
  loadCredentials: () => Promise<TtsCredentials | null>;
  synthesize: (input: {
    text: string;
    voiceId: string;
    credentials: TtsCredentials;
    signal: AbortSignal;
  }) => Promise<SynthesisResult>;
  // Resolves when playback ends; false when the binary cannot play audio.
  playAudio: (chunks: string[]) => Promise<boolean>;
  // AVSpeechSynthesizer with a voice picked by gender + language; resolves
  // when the utterance ends.
  speakOnDevice: (text: string, options: DeviceSpeakOptions) => Promise<void>;
  stopOnDevice: () => Promise<void>;
};

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

export const languageForText = (text: string): DeviceSpeakOptions["language"] =>
  CJK.test(text) ? "zh-CN" : "en-US";

/**
 * Cloud voice first, on-device voice of the same gender second.
 *
 * Speak resolves when the utterance has finished (the call loop waits on
 * it). Stop aborts a synthesis in flight and silences the device; a reply
 * whose audio arrives after stop is dropped. One refusal of the credentials
 * turns the cloud off for the rest of the session so a bad key costs one
 * request, not one per reply; a speaker the account has not enabled is
 * remembered on its own and only that voice falls back.
 */
export const createSpeechEngine = (deps: SpeechEngineDeps): TtsEngine => {
  let cloudDisabled = false;
  const disabledVoices = new Set<string>();
  let utterance = 0;
  let controller: AbortController | null = null;

  const current = (token: number) => utterance === token;

  const synthesizeAll = async (
    text: string,
    voiceId: string,
    credentials: TtsCredentials,
    signal: AbortSignal
  ): Promise<string[] | null> => {
    const parts = splitForSynthesis(text);
    if (parts.length === 0) {
      return null;
    }
    const results = await Promise.all(
      parts.map((part) =>
        deps.synthesize({ text: part, voiceId, credentials, signal })
      )
    );
    const chunks: string[] = [];
    for (const result of results) {
      if (!result.ok) {
        switch (result.reason) {
          case "auth":
            cloudDisabled = true;
            break;
          case "voice":
            disabledVoices.add(voiceId);
            break;
          case "request_failed":
            break;
          default: {
            const exhaustive: never = result.reason;
            return exhaustive;
          }
        }
        return null;
      }
      chunks.push(...result.chunks);
    }
    return chunks;
  };

  const speak = async ({ text, voiceId }: TtsSpeakInput) => {
    const token = (utterance += 1);
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const voice = voiceById(voiceId);
    const device: DeviceSpeakOptions = {
      gender: voice?.gender,
      language: languageForText(text),
    };

    if (voice && !cloudDisabled && !disabledVoices.has(voice.id)) {
      let credentials: TtsCredentials | null = null;
      try {
        credentials = await deps.loadCredentials();
      } catch {
        credentials = null;
      }
      if (!current(token)) {
        return;
      }
      if (credentials) {
        let chunks: string[] | null = null;
        try {
          chunks = await synthesizeAll(text, voice.id, credentials, signal);
        } catch {
          chunks = null;
        }
        if (!current(token)) {
          return;
        }
        if (chunks && chunks.length > 0) {
          const played = await deps.playAudio(chunks);
          if (played || !current(token)) {
            return;
          }
        }
      }
    }
    if (!current(token)) {
      return;
    }
    await deps.speakOnDevice(text, device);
  };

  const stop = async () => {
    utterance += 1;
    controller?.abort();
    controller = null;
    await deps.stopOnDevice();
  };

  return { speak, stop };
};
