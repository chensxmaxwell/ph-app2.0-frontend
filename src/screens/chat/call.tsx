import React, { useEffect, useMemo, useRef, useState } from "react";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { usePersonFace } from "../avatar/use-person-face";
import { CallBody } from "../call/call-body";
import { useVoiceCall } from "../call/use-voice-call";
import { ChatGradient } from "./background";
import { useChat } from "./store";

type CallRoute = RouteProp<{ ChatCall: { threadId: string } }, "ChatCall">;

// Voice / video call from a Message thread. Minimize (top-left) keeps the
// call flagged on the thread; hang-up clears it. Hangup vs minimize is
// decided through a ref so the unmount cleanup never ends a minimized call.
export const ChatCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<CallRoute>();
  const threadId = route.params.threadId;
  const {
    getThread,
    setInCall,
    setListen,
    stopSpeaking,
    recordCallExchange,
  } = useChat();
  const thread = getThread(threadId);
  const { face } = usePersonFace(threadId, thread?.kind);
  const name = thread?.name ?? "Kevin";
  const messages = thread?.messages;
  const history = useMemo(
    () => (messages ?? []).map((item) => ({ from: item.from, text: item.text })),
    [messages]
  );
  const call = useVoiceCall({
    name,
    personality: thread?.personality,
    story: thread?.description,
    history,
    onExchange: (userText, reply) =>
      recordCallExchange(threadId, userText, reply),
  });
  const [video, setVideo] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const endedRef = useRef(false);

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
    const timer = setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [call.connected]);

  return (
    <ChatGradient>
      <CallBody
        name={name}
        face={face}
        call={call}
        elapsed={elapsed}
        video={video}
        onToggleVideo={() => setVideo((current) => !current)}
        onMinimize={() => navigation.goBack()}
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
