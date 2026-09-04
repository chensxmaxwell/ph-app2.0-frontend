import { useCallback, useEffect, useRef, useState } from "react";
import {
  CompanionChatError,
  companionChatErrorMessage,
  companionChatFailureMessage,
  completeCompanionChat,
} from "../../services/llm";
import { hasLlmKey, loadLlmConfig } from "../../services/llm-config";
import {
  Ringback,
  RINGBACK_DURATION_MS,
  startRingback,
} from "../../services/ringtone";
import { ttsSpeak, ttsStop } from "../../services/tts";
import { ttsCredentialsFromConfig } from "../../services/tts-config";
import { listenForUtterance, stopVoiceInput } from "../../services/voice-input";
import { localOpener, OPENER_INSTRUCTION } from "./opener";
import { CallPhase, micButtonEnabled, voiceKeyHint } from "./status";

// The call rings (`startRingback`, a WeChat-style ring-back of about four
// seconds) before the companion picks up; this is that ring's length, and
// the silent wait when the tone cannot be played (Maxwell, TestFlight
// 1.2 (19)).
export const CALL_CONNECT_DELAY_MS = RINGBACK_DURATION_MS;
// The mic is inert while the companion's opener is on its way, so that wait
// is bounded: past this, the canned line is spoken and the loop goes on.
export const OPENER_TIMEOUT_MS = 6000;
// End-pointing handed to the native recognizer: how long the user must be
// quiet before what they said is sent, the longest single utterance, and how
// long an empty listen runs before it is started again (iOS Speech caps one
// request at about a minute).
export const LISTEN_SILENCE_MS = 1100;
export const LISTEN_MAX_MS = 20000;
export const LISTEN_IDLE_MS = 45000;
// A listen that ends without having run — empty this soon after it opened
// (iOS Speech with no network errors right after it starts), or refused for
// a reason that passes — is a stall: reopen after a pause rather than tear
// the audio engine down and up in a tight loop. After a few in a row the
// call says so and keeps trying at a slower pace. It never stops to wait
// for a tap (Maxwell, TestFlight 1.2 (18)).
export const LISTEN_FAST_EMPTY_MS = 1000;
export const LISTEN_RETRY_DELAY_MS = 1500;
export const LISTEN_MAX_STALLS = 3;
export const LISTEN_RECOVER_DELAY_MS = 5000;
export const LISTEN_UNRESPONSIVE_COPY =
  "Voice input isn't responding. Trying again…";

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
  // the mic opens right away. Otherwise the ring-back tone plays first (or
  // the line is held for this long when it cannot) and the companion greets
  // before anyone is asked to talk.
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

// Settles like `promise`, or rejects once `ms` have passed without it.
const within = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out after ${ms} ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

/**
 * The conversation behind a voice or video call, hands-free. The loop is
 * still strictly sequential — PHNative's iOS Speech recognizer owns
 * AVAudioSession while the mic is open and the synthesizer needs it back for
 * the reply — but the turns take themselves: the call rings (a ring-back
 * tone, `startRingback`), the companion greets, the mic opens, the native
 * side reports when the user has finished, the reply is spoken, the mic
 * opens again. No tap is ever needed to talk: the mic is
 * inert until the companion has greeted, and a recognizer that stalls is
 * reopened by the loop itself. The mic is never open while the companion is
 * talking (it would hear itself), so barge-in is a tap: stop the voice, open
 * the mic. The only stops that wait for a tap are the ones only the user can
 * clear: mute, the mic permission, a missing Ark key.
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
  // A call already in progress is listening from its first frame; a tap is
  // never what opens the mic.
  const [phase, setPhase] = useState<CallPhase>(
    connectDelayMs > 0 ? "connecting" : "listening"
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
  // Listens that ended without running, in a row, and the notice they put
  // up (taken down again once a listen runs).
  const stallsRef = useRef(0);
  const stallNoticeRef = useRef<string | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The ring-back while the call is `connecting`; hang-up and minimize cut
  // it so no tone outlives the screen.
  const ringRef = useRef<Ringback | null>(null);
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

  // The recognizer ran (it heard something, or listened for its whole
  // window): forget the stalls and take down the notice they raised.
  const recovered = useCallback(() => {
    stallsRef.current = 0;
    const stale = stallNoticeRef.current;
    if (stale !== null) {
      stallNoticeRef.current = null;
      setNotice((now) => (now === stale ? null : now));
    }
  }, []);

  // Open the mic for one utterance, answer it, speak, and open the mic
  // again — until the token changes or the recognizer is refused for
  // something only the user can fix.
  const listen = useCallback(
    (turn: number) => {
      if (!current(turn) || mutedRef.current) {
        return;
      }
      // The listen ended without running: reopen after a pause, slower and
      // with a notice once it keeps happening. The call stays `listening` —
      // the mic is armed and the loop, not a tap, brings it back.
      const stalled = (copy: string) => {
        stallsRef.current += 1;
        const unresponsive = stallsRef.current >= LISTEN_MAX_STALLS;
        if (unresponsive) {
          stallNoticeRef.current = copy;
          setNotice(copy);
        }
        retryRef.current = setTimeout(
          () => {
            retryRef.current = null;
            listen(turn);
          },
          unresponsive ? LISTEN_RECOVER_DELAY_MS : LISTEN_RETRY_DELAY_MS
        );
      };
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
          if (result.reason === "permission-denied") {
            // Only Settings can change this; retrying would be refused at
            // once every time. The loop stops and the mic offers Resume.
            setNotice(result.message);
            setPhase("ready");
            return;
          }
          stalled(result.message);
          return;
        }
        if (result.end === "stopped") {
          // Whoever closed the mic owns the phase now.
          return;
        }
        const userText = result.text.trim();
        if (!userText) {
          if (Date.now() - openedAt >= LISTEN_FAST_EMPTY_MS) {
            recovered();
            listen(turn);
            return;
          }
          stalled(LISTEN_UNRESPONSIVE_COPY);
          return;
        }
        recovered();
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
    [current, record, recovered, speak]
  );

  // The companion speaks first: Ark's opener in character when a key is
  // saved, a canned line in their name otherwise (or when Ark is slow — the
  // mic is inert until this line is spoken). Then the mic opens.
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
          opener = await within(
            completeCompanionChat({
              name: input.name,
              userText: "",
              instruction: OPENER_INSTRUCTION,
              history: input.history,
              personality: input.personality,
              story: input.story,
            }),
            OPENER_TIMEOUT_MS
          );
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
    // Ring, then pick up: the tone runs its course (or the line is held for
    // as long) before the companion's first word. Unmount while it rings
    // cancels it — no orphan audio behind a minimized or closed screen.
    const ring = startRingback({ fallbackMs: connectDelayMs });
    ringRef.current = ring;
    ring.finished.then((end) => {
      if (ringRef.current === ring) {
        ringRef.current = null;
      }
      if (
        end === "cancelled" ||
        !current(turn) ||
        phaseRef.current !== "connecting"
      ) {
        return;
      }
      setPhase("greeting");
      greetThenListen(turn).catch(swallow);
    });
    return () => ring.cancel();
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
    recovered();
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
  }, [listen, recovered]);

  const hangUp = useCallback(() => {
    aliveRef.current = false;
    turnRef.current += 1;
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    if (ringRef.current) {
      ringRef.current.cancel();
      ringRef.current = null;
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
