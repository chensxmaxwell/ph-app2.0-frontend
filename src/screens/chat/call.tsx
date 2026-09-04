import React, { useEffect, useMemo, useRef, useState } from "react";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { voiceForPerson } from "../../services/voices";
import { usePersonFace } from "../avatar/use-person-face";
import { CallBody } from "../call/call-body";
import { useVoiceCall } from "../call/use-voice-call";
import { ChatGradient } from "./background";
import { useChat } from "./store";

type CallRoute = RouteProp<{ ChatCall: { threadId: string } }, "ChatCall">;

// Voice / video call from a Message thread. Minimize (top-left) takes the
// screen down and leaves the call on: flagged on the thread with its clock in
// the chat store, shown as the floating face pill (`MessageCallPill`) that
// brings this screen back already connected. The mic closes while the screen
// is down (the thread has its own) and opens again on restore. Hang-up is
// the only end. Hangup vs minimize is decided through a ref so the unmount
// cleanup never ends a minimized call. Nothing said on the call is written
// to the thread.
export const ChatCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<CallRoute>();
  const threadId = route.params.threadId;
  const {
    getThread,
    setInCall,
    startCallTimer,
    minimizeCall,
    setListen,
    stopSpeaking,
    inCallThreadId,
    inCallStartedAt,
  } = useChat();
  const thread = getThread(threadId);
  const { face } = usePersonFace(threadId, thread?.kind);
  const name = thread?.name ?? "Kevin";
  const messages = thread?.messages;
  // The thread grounds the replies; the call never writes back to it. What
  // is said on the call stays on the call (`call.transcript`).
  const history = useMemo(
    () => (messages ?? []).map((item) => ({ from: item.from, text: item.text })),
    [messages]
  );
  // Re-entered from the thread while the call is flagged: already on, no
  // ring and no second greeting.
  const [ring] = useState(() => inCallThreadId !== threadId);
  const call = useVoiceCall({
    name,
    personality: thread?.personality,
    story: thread?.description,
    history,
    voiceId: voiceForPerson({ id: threadId, thread }).id,
    ring,
  });
  const [video, setVideo] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const endedRef = useRef(false);
  // The clock starts when the call connects and lives in the store, so a
  // minimized call keeps counting and a restored one carries on.
  const elapsed =
    call.connected && inCallStartedAt
      ? Math.max(0, Math.floor((now - inCallStartedAt) / 1000))
      : 0;

  // Once per thread: flag the call and switch off Listen (the thread reads
  // replies aloud; the call speaks them itself). Store callbacks and the
  // one-time `listen` check are read at mount on purpose.
  useEffect(() => {
    setInCall(threadId);
    if (thread?.listen) {
      setListen(thread.id, false);
      stopSpeaking();
    }
    return () => {
      if (endedRef.current) {
        setInCall(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (!call.connected) {
      return;
    }
    startCallTimer(threadId);
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [call.connected, startCallTimer, threadId]);

  return (
    <ChatGradient>
      <CallBody
        name={name}
        face={face}
        call={call}
        elapsed={elapsed}
        video={video}
        onToggleVideo={() => setVideo((current) => !current)}
        onMinimize={() => {
          minimizeCall();
          navigation.goBack();
        }}
        onHangUp={() => {
          endedRef.current = true;
          call.hangUp();
          setInCall(null);
          navigation.goBack();
        }}
      />
    </ChatGradient>
  );
};
