import { useCallback, useEffect, useRef, useState } from "react";
import {
  CompanionChatError,
  companionChatErrorMessage,
  companionChatFailureMessage,
  completeCompanionChat,
} from "../../services/llm";
import { hasLlmKey, loadLlmConfig } from "../../services/llm-config";
import { ttsSpeak, ttsStop } from "../../services/tts";
import { ttsCredentialsFromConfig } from "../../services/tts-config";
import { listenForUtterance, stopVoiceInput } from "../../services/voice-input";
import { localOpener, OPENER_INSTRUCTION } from "./opener";
import { CallPhase, micButtonEnabled, voiceKeyHint } from "./status";

export const CALL_CONNECT_DELAY_MS = 1600;
// End-pointing handed to the native recognizer: how long the user must be
// quiet before what they said is sent, the longest single utterance, and how
// long an empty listen runs before it is started again (iOS Speech caps one
// request at about a minute).
export const LISTEN_SILENCE_MS = 1100;
export const LISTEN_MAX_MS = 20000;
export const LISTEN_IDLE_MS = 45000;
// An empty listen that ends this soon after it opened did not run its idle
// window: the recognizer gave up (iOS Speech with no network errors right
// after it starts). Reopen after a pause, and stop after a few in a row
// instead of tearing the audio engine down and up in a tight loop.
export const LISTEN_FAST_EMPTY_MS = 1000;
export const LISTEN_RETRY_DELAY_MS = 1500;
export const LISTEN_MAX_FAST_EMPTIES = 3;
export const LISTEN_UNRESPONSIVE_COPY =
  "Voice input isn't responding. Tap the mic to try again.";

export type CallTurn = { from: "me" | "them"; text: string };

export type VoiceCallInput = {
  name: string;
  personality?: string;
  story?: string;
  // The chat the replies are grounded in: the Message thread's bubbles or the
  // Love chat's. Read-only for the call — nothing said here is written back.
  history: CallTurn[];
  // The person's assigned voice (src/services/voices.ts); every reply is
  // spoken with it.
  voiceId?: string;
  // 0 when the call is already running (a Love call restored from the pill,
  // a Message call re-entered from the thread): no ring, no second opener,
  // the mic opens right away. Otherwise the call rings first and the
  // companion greets before anyone is asked to talk.
  connectDelayMs?: number;
};

export type VoiceCall = {
  phase: CallPhase;
  connected: boolean;
  keyMissing: boolean;
  notice: string | null;
  // "Using the phone's voice…" while no speech-console key is saved.
  voiceHint: string | null;
  heard: string | null;
  reply: string | null;
  // What was said on this call, oldest first. It grounds the next reply and
  // lives on the call only: nothing here is ever written to a chat thread
  // (Maxwell, TestFlight 1.2 (15)).
  transcript: CallTurn[];
  muted: boolean;
  // The one mic control: interrupt while the companion speaks, mute while
  // listening, open the mic again otherwise.
  pressMic: () => void;
  hangUp: () => void;
};

const swallow = () => undefined;

/**
 * The conversation behind a voice or video call, hands-free. The loop is
 * still strictly sequential — PHNative's iOS Speech recognizer owns
 * AVAudioSession while the mic is open and the synthesizer needs it back for
 * the reply — but the turns take themselves: the companion greets, the mic
 * opens, the native side reports when the user has finished, the reply is
 * spoken, the mic opens again. The mic is never open while the companion is
 * talking (it would hear itself), so barge-in is a tap: stop the voice, open
 * the mic.
 *
 * Every user action bumps a turn token; an async step only applies its
 * result if the token it started with is still current, so a tap, mute or
 * hang-up cancels whatever was in flight. Hang-up silences everything.
 * Unmount without hang-up (minimize) closes the mic and stops the loop; a
 * restored call mounts a fresh hook with `connectDelayMs` 0.
 */
export const useVoiceCall = ({
  name,
  personality,
  story,
  history,
  voiceId,
  connectDelayMs = CALL_CONNECT_DELAY_MS,
}: VoiceCallInput): VoiceCall => {
  const [phase, setPhase] = useState<CallPhase>(
    connectDelayMs > 0 ? "connecting" : "ready"
  );
  const [keyMissing, setKeyMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<CallTurn[]>([]);
  const [muted, setMuted] = useState(false);

  const aliveRef = useRef(true);
  const phaseRef = useRef<CallPhase>(phase);
  phaseRef.current = phase;
  const mutedRef = useRef(false);
  // The transcript the next reply is grounded in, readable from inside an
  // async step without waiting for a render.
  const transcriptRef = useRef<CallTurn[]>([]);
  // Bumped by every user action; an async step only applies its result when
  // the token it started with is still current.
  const turnRef = useRef(0);
  // Empty listens that ended almost as soon as they opened, in a row.
  const fastEmptiesRef = useRef(0);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef({ name, personality, story, history, voiceId });
  inputRef.current = { name, personality, story, history, voiceId };

  const current = useCallback(
    (turn: number) => aliveRef.current && turnRef.current === turn,
    []
  );

  const record = useCallback((...turns: CallTurn[]) => {
    transcriptRef.current = [...transcriptRef.current, ...turns];
    setTranscript(transcriptRef.current);
  }, []);

  // A call reply asks the cloud for its expressive rendering of the voice.
  const speak = useCallback(async (text: string) => {
    setReply(text);
    setPhase("speaking");
    await ttsSpeak({
      id: `call-${Date.now()}`,
      text,
      voiceId: inputRef.current.voiceId,
      expressive: true,
    });
  }, []);

  // Open the mic for one utterance, answer it, speak, and open the mic
  // again — until the token changes or the recognizer reports a failure.
  const listen = useCallback(
    (turn: number) => {
      if (!current(turn) || mutedRef.current) {
        return;
      }
      setPhase("listening");
      const openedAt = Date.now();
      listenForUtterance({
        silenceMs: LISTEN_SILENCE_MS,
        maxMs: LISTEN_MAX_MS,
        idleMs: LISTEN_IDLE_MS,
      }).then(async (result) => {
        if (!current(turn)) {
          return;
        }
        if (!result.ok) {
          setNotice(result.message);
          setPhase("ready");
          return;
        }
        if (result.end === "stopped") {
          // Whoever closed the mic owns the phase now.
          return;
        }
        const userText = result.text.trim();
        if (!userText) {
          if (Date.now() - openedAt >= LISTEN_FAST_EMPTY_MS) {
            fastEmptiesRef.current = 0;
            listen(turn);
            return;
          }
          fastEmptiesRef.current += 1;
          if (fastEmptiesRef.current >= LISTEN_MAX_FAST_EMPTIES) {
            fastEmptiesRef.current = 0;
            setNotice(LISTEN_UNRESPONSIVE_COPY);
            setPhase("ready");
            return;
          }
          retryRef.current = setTimeout(() => {
            retryRef.current = null;
            listen(turn);
          }, LISTEN_RETRY_DELAY_MS);
          return;
        }
        fastEmptiesRef.current = 0;
        setHeard(userText);
        setNotice(null);
        setPhase("thinking");
        const input = inputRef.current;
        try {
          const replyText = await completeCompanionChat({
            name: input.name,
            userText,
            history: [...input.history, ...transcriptRef.current],
            personality: input.personality,
            story: input.story,
          });
          if (!current(turn)) {
            return;
          }
          record(
            { from: "me", text: userText },
            { from: "them", text: replyText }
          );
          setNotice(null);
          await speak(replyText);
          if (current(turn)) {
            listen(turn);
          }
        } catch (error) {
          if (!current(turn)) {
            return;
          }
          record({ from: "me", text: userText });
          setNotice(companionChatErrorMessage(error));
          if (
            error instanceof CompanionChatError &&
            error.code === "missing_key"
          ) {
            // Nothing will answer until a key is saved; stop asking.
            setPhase("ready");
            return;
          }
          listen(turn);
        }
      });
    },
    [current, record, speak]
  );

  // The companion speaks first: Ark's opener in character when a key is
  // saved, a canned line in their name otherwise. Then the mic opens.
  const greetThenListen = useCallback(
    async (turn: number) => {
      const input = inputRef.current;
      let opener = localOpener(input.name);
      let hasKey = false;
      try {
        hasKey = hasLlmKey(await loadLlmConfig());
      } catch {
        hasKey = false;
      }
      if (!current(turn)) {
        return;
      }
      if (hasKey) {
        try {
          opener = await completeCompanionChat({
            name: input.name,
            userText: "",
            instruction: OPENER_INSTRUCTION,
            history: input.history,
            personality: input.personality,
            story: input.story,
          });
        } catch {
          opener = localOpener(input.name);
        }
        if (!current(turn)) {
          return;
        }
      }
      record({ from: "them", text: opener });
      await speak(opener);
      if (current(turn)) {
        listen(turn);
      }
    },
    [current, listen, record, speak]
  );

  useEffect(() => {
    let mounted = true;
    loadLlmConfig()
      .then((config) => {
        if (!mounted) {
          return;
        }
        if (!hasLlmKey(config)) {
          setKeyMissing(true);
          setNotice(companionChatFailureMessage("missing_key"));
        }
        const credentials = ttsCredentialsFromConfig(config);
        const cloudVoice =
          credentials !== null &&
          (credentials.kind === "app" || credentials.source === "tts");
        setVoiceHint(cloudVoice ? null : voiceKeyHint(inputRef.current.name));
      })
      .catch(swallow);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const turn = turnRef.current;
    if (connectDelayMs <= 0) {
      // Already on the call: cut whatever was still being said when the
      // screen went away (the mic must never hear the companion), then
      // listen.
      ttsStop().catch(swallow);
      listen(turn);
      return;
    }
    const timer = setTimeout(() => {
      if (!current(turn) || phaseRef.current !== "connecting") {
        return;
      }
      setPhase("ready");
      greetThenListen(turn).catch(swallow);
    }, connectDelayMs);
    return () => clearTimeout(timer);
  }, [connectDelayMs, current, greetThenListen, listen]);

  // Unmount without hang-up (minimize): close the mic and stop the loop. A
  // reply already being spoken finishes on its own.
  useEffect(() => {
    return () => {
      aliveRef.current = false;
      turnRef.current += 1;
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      if (phaseRef.current === "listening") {
        stopVoiceInput().catch(swallow);
      }
    };
  }, []);

  const pressMic = useCallback(() => {
    if (!aliveRef.current || !micButtonEnabled(phaseRef.current)) {
      return;
    }
    const turn = (turnRef.current += 1);
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    fastEmptiesRef.current = 0;
    setNotice(null);
    if (mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
      if (phaseRef.current === "speaking") {
        ttsStop().catch(swallow);
      }
      listen(turn);
      return;
    }
    switch (phaseRef.current) {
      case "listening":
        mutedRef.current = true;
        setMuted(true);
        stopVoiceInput().catch(swallow);
        setPhase("ready");
        return;
      case "speaking":
        // Barge-in: the user talks over the reply.
        ttsStop().catch(swallow);
        listen(turn);
        return;
      case "thinking":
      case "ready":
        listen(turn);
        return;
      default: {
        const exhaustive: never = phaseRef.current;
        return exhaustive;
      }
    }
  }, [listen]);

  const hangUp = useCallback(() => {
    aliveRef.current = false;
    turnRef.current += 1;
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    if (phaseRef.current === "listening") {
      stopVoiceInput().catch(swallow);
    }
    ttsStop().catch(swallow);
    setPhase("ready");
  }, []);

  return {
    phase,
    connected: phase !== "connecting",
    keyMissing,
    notice,
    voiceHint,
    heard,
    reply,
    transcript,
    muted,
    pressMic,
    hangUp,
  };
};
