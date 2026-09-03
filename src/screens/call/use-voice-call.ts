import { useCallback, useEffect, useRef, useState } from "react";
import {
  companionChatErrorMessage,
  companionChatFailureMessage,
  completeCompanionChat,
} from "../../services/llm";
import { hasLlmKey, loadLlmConfig } from "../../services/llm-config";
import { ttsSpeak, ttsStop } from "../../services/tts";
import { startVoiceInput, stopVoiceInput } from "../../services/voice-input";
import { CallPhase, NOTHING_HEARD_COPY } from "./status";

export const CALL_CONNECT_DELAY_MS = 1600;

export type CallTurn = { from: "me" | "them"; text: string };

export type VoiceCallInput = {
  name: string;
  personality?: string;
  story?: string;
  // The live transcript the reply is grounded in: the Message thread's
  // bubbles or the Love chat's, including turns this call already wrote.
  history: CallTurn[];
  // Called once per completed turn so the screen can write it to its chat.
  onExchange?: (userText: string, reply: string) => void;
  // 0 when the call is already running (a Love call restored from the pill);
  // otherwise the call rings first.
  connectDelayMs?: number;
};

export type VoiceCall = {
  phase: CallPhase;
  connected: boolean;
  keyMissing: boolean;
  notice: string | null;
  heard: string | null;
  reply: string | null;
  holdStart: () => void;
  holdEnd: () => void;
  hangUp: () => void;
};

/**
 * The conversation behind a voice or video call. Push-to-talk on purpose:
 * PHNative's iOS Speech recognizer owns AVAudioSession while the mic is
 * open, and AVSpeechSynthesizer needs it back for the reply, so the loop is
 * strictly hold → release → reply → speak. Nothing here listens while the
 * companion talks, and the avatar WebView never sees the audio session.
 *
 * Hang-up cancels every in-flight step. Unmounting without hang-up
 * (minimize) only releases the mic: a reply already on its way still lands
 * in the chat and is spoken, because the call is still on.
 */
export const useVoiceCall = ({
  name,
  personality,
  story,
  history,
  onExchange,
  connectDelayMs = CALL_CONNECT_DELAY_MS,
}: VoiceCallInput): VoiceCall => {
  const [phase, setPhase] = useState<CallPhase>(
    connectDelayMs > 0 ? "connecting" : "ready"
  );
  const [keyMissing, setKeyMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const phaseRef = useRef<CallPhase>(phase);
  phaseRef.current = phase;
  // Bumped by every user action; an async step only applies its result when
  // the token it started with is still current.
  const turnRef = useRef(0);
  const inputRef = useRef({ name, personality, story, history, onExchange });
  inputRef.current = { name, personality, story, history, onExchange };

  const current = useCallback(
    (turn: number) => aliveRef.current && turnRef.current === turn,
    []
  );

  useEffect(() => {
    let mounted = true;
    loadLlmConfig()
      .then((config) => {
        if (mounted && !hasLlmKey(config)) {
          setKeyMissing(true);
          setNotice(companionChatFailureMessage("missing_key"));
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (connectDelayMs <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      if (aliveRef.current && phaseRef.current === "connecting") {
        setPhase("ready");
      }
    }, connectDelayMs);
    return () => clearTimeout(timer);
  }, [connectDelayMs]);

  // Unmount releases the microphone; only hang-up silences the voice.
  useEffect(() => {
    return () => {
      if (phaseRef.current === "listening") {
        stopVoiceInput().catch(() => undefined);
      }
    };
  }, []);

  const holdStart = useCallback(() => {
    if (!aliveRef.current || phaseRef.current === "connecting") {
      return;
    }
    const turn = (turnRef.current += 1);
    if (phaseRef.current === "speaking") {
      // Barge-in: the user talks over the reply.
      ttsStop().catch(() => undefined);
    }
    setNotice(null);
    setPhase("listening");
    startVoiceInput().then((result) => {
      if (!current(turn) || result.ok) {
        return;
      }
      setNotice(result.message);
      setPhase("ready");
    });
  }, [current]);

  const holdEnd = useCallback(() => {
    if (!aliveRef.current || phaseRef.current !== "listening") {
      return;
    }
    const turn = (turnRef.current += 1);
    setPhase("thinking");
    stopVoiceInput().then(async (result) => {
      if (!current(turn)) {
        return;
      }
      if (!result.ok) {
        setNotice(result.message);
        setPhase("ready");
        return;
      }
      const userText = result.text.trim();
      if (!userText) {
        setNotice(NOTHING_HEARD_COPY);
        setPhase("ready");
        return;
      }
      setHeard(userText);
      const input = inputRef.current;
      try {
        const replyText = await completeCompanionChat({
          name: input.name,
          userText,
          history: input.history,
          personality: input.personality,
          story: input.story,
        });
        if (!current(turn)) {
          return;
        }
        setReply(replyText);
        setNotice(null);
        input.onExchange?.(userText, replyText);
        setPhase("speaking");
        await ttsSpeak({ id: `call-${Date.now()}`, text: replyText });
        if (current(turn)) {
          setPhase("ready");
        }
      } catch (error) {
        if (!current(turn)) {
          return;
        }
        setNotice(companionChatErrorMessage(error));
        setPhase("ready");
      }
    });
  }, [current]);

  const hangUp = useCallback(() => {
    aliveRef.current = false;
    turnRef.current += 1;
    if (phaseRef.current === "listening") {
      stopVoiceInput().catch(() => undefined);
    }
    ttsStop().catch(() => undefined);
    setPhase("ready");
  }, []);

  return {
    phase,
    connected: phase !== "connecting",
    keyMissing,
    notice,
    heard,
    reply,
    holdStart,
    holdEnd,
    hangUp,
  };
};
