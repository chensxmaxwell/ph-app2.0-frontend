import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ttsSpeak, ttsStop } from "../../services/tts";
import {
  companionChatErrorMessage,
  completeCompanionChat,
} from "../../services/llm";
import { seedDirectory, seedThreads } from "../../backend/chat-seed";
import { getCurrentUserId, subscribeSessionUser } from "../../backend/session";
import { loadChat, saveChat } from "../../backend/store";
import { regenerateTargetId } from "./regenerate";
import {
  ChatBubble,
  ChatThread,
  DirectoryPerson,
  FriendRequest,
} from "./types";

export const FREE_HUMAN_MESSAGE_LIMIT = 1;

type ChatContextValue = {
  threads: ChatThread[];
  directory: DirectoryPerson[];
  isPremium: boolean;
  speakingId: string | null;
  inCallThreadId: string | null;
  getThread: (id: string) => ChatThread | undefined;
  setListen: (threadId: string, listen: boolean) => void;
  setPinned: (threadId: string, pinned: boolean) => void;
  setSynced: (threadId: string, synced: boolean) => void;
  sendText: (threadId: string, text: string) => void;
  sendVoice: (threadId: string) => void;
  editLastMine: (threadId: string, text: string) => void;
  regenerate: (threadId: string) => void;
  speakMessage: (threadId: string, message: ChatBubble) => void;
  stopSpeaking: () => void;
  setRequest: (threadId: string, request: FriendRequest) => void;
  sendFriendRequest: (person: DirectoryPerson) => string;
  cancelFriendRequest: (threadId: string) => void;
  setPremium: (value: boolean) => void;
  setInCall: (threadId: string | null) => void;
  createBot: (input: {
    name: string;
    gender: string;
    birthday: string;
    description: string;
  }) => string;
  updateBot: (
    threadId: string,
    input: {
      name: string;
      gender: string;
      birthday: string;
      description: string;
      personality?: string;
    }
  ) => void;
  upsertCompanionThread: (companion: {
    id: string;
    name: string;
    gender: string;
    birthday: string;
    personalities: string[];
    story: string;
  }) => void;
  humanLimitReached: (thread: ChatThread) => boolean;
  chatNotice: (threadId: string) => string | undefined;
  /** True while a send / voice / regenerate request is waiting on Ark. */
  replyPending: (threadId: string) => boolean;
};


const loadThreadsFromStore = async (userId: string): Promise<{
  threads: ChatThread[];
  isPremium: boolean;
}> => {
  const blob = await loadChat(userId);
  const threads = Array.isArray(blob.threads) ? blob.threads : [];
  return {
    threads: mergeSeedThreads(dedupeThreads(threads)),
    isPremium: !!blob.isPremium,
  };
};

const persistThreadsToStore = async (
  userId: string,
  threads: ChatThread[],
  isPremium: boolean
) => {
  await saveChat(userId, { threads, isPremium });
};

const ChatContext = createContext<ChatContextValue | null>(null);

const nextId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const DEFAULT_BOT_IDS: Record<string, string> = {
  kevin: "kevin",
  chad: "chad",
  amanda: "amanda",
};

const defaultBotIdForName = (name?: string) =>
  DEFAULT_BOT_IDS[(name ?? "").trim().toLowerCase()];

const findSameBot = (
  threads: ChatThread[],
  id: string,
  name: string
) => {
  const byId = threads.find((thread) => thread.id === id);
  if (byId) {
    return byId;
  }
  const canonical = defaultBotIdForName(name);
  if (canonical) {
    return (
      threads.find((thread) => thread.id === canonical) ||
      threads.find(
        (thread) =>
          thread.name.trim().toLowerCase() === name.trim().toLowerCase()
      )
    );
  }
  return undefined;
};

const dedupeThreads = (threads: ChatThread[]) => {
  const result: ChatThread[] = [];
  const taken = new Set<string>();
  for (const thread of threads) {
    const key = defaultBotIdForName(thread.name) ?? thread.id;
    if (taken.has(key)) {
      const index = result.findIndex(
        (item) => (defaultBotIdForName(item.name) ?? item.id) === key
      );
      if (index === -1) {
        continue;
      }
      const current = result[index];
      const richer =
        thread.messages.length > current.messages.length ? thread : current;
      result[index] = { ...richer, id: key };
      continue;
    }
    taken.add(key);
    result.push({
      ...thread,
      id: defaultBotIdForName(thread.name) ?? thread.id,
    });
  }
  return result;
};

const mergeSeedThreads = (stored: ChatThread[]) => {
  const seeds = seedThreads();
  const byId = new Map(stored.map((thread) => [thread.id, thread]));
  for (const seed of seeds) {
    const existing = byId.get(seed.id);
    if (!existing) {
      byId.set(seed.id, seed);
      continue;
    }
    if (!existing.messages.length && seed.messages.length) {
      byId.set(seed.id, {
        ...existing,
        preview: existing.preview || seed.preview,
        messages: seed.messages,
        request:
          existing.request === "incoming" && seed.request === "none"
            ? seed.request
            : existing.request,
        kind: existing.kind === "human" && seed.kind === "bot" ? seed.kind : existing.kind,
      });
    }
  }
  return dedupeThreads(Array.from(byId.values()));
};

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [threads, setThreads] = useState<ChatThread[]>(seedThreads);
  const [directory] = useState<DirectoryPerson[]>(seedDirectory);
  const [isPremium, setIsPremium] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [inCallThreadId, setInCallThreadId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [chatNotices, setChatNotices] = useState<Record<string, string>>({});
  // Count of companion replies still in flight per thread. The ref mirrors the
  // state so a tap can be refused in the same frame it was started.
  const [pendingReplies, setPendingReplies] = useState<Record<string, number>>(
    {}
  );
  const pendingRepliesRef = useRef<Record<string, number>>({});

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  const resetPendingReplies = useCallback(() => {
    pendingRepliesRef.current = {};
    setPendingReplies({});
  }, []);

  const adjustPendingReply = useCallback((threadId: string, delta: 1 | -1) => {
    const count = Math.max(
      0,
      (pendingRepliesRef.current[threadId] ?? 0) + delta
    );
    const next = { ...pendingRepliesRef.current };
    if (count === 0) {
      delete next[threadId];
    } else {
      next[threadId] = count;
    }
    pendingRepliesRef.current = next;
    setPendingReplies(next);
  }, []);

  const isReplyPending = useCallback(
    (threadId: string) => (pendingRepliesRef.current[threadId] ?? 0) > 0,
    []
  );

  useEffect(() => {
    const unsubscribe = subscribeSessionUser((user) => {
      const nextId = user?.id ?? null;
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      userIdRef.current = nextId;
      setHydrated(false);
      resetPendingReplies();
      if (!nextId) {
        setThreads(seedThreads());
        setIsPremium(false);
        setChatNotices({});
        setHydrated(true);
        return;
      }
      setChatNotices({});
      loadThreadsFromStore(nextId)
        .then((loaded) => {
          if (userIdRef.current !== nextId) {
            return;
          }
          if (loaded.threads.length > 0) {
            setThreads(loaded.threads);
          } else {
            setThreads(seedThreads());
          }
          setIsPremium(loaded.isPremium);
        })
        .catch(() => {
          if (userIdRef.current === nextId) {
            setThreads(seedThreads());
          }
        })
        .finally(() => {
          if (userIdRef.current === nextId) {
            setHydrated(true);
          }
        });
    });
    return () => {
      unsubscribe();
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
      }
    };
  }, [resetPendingReplies]);

  useEffect(() => {
    if (!hydrated || !userIdRef.current) {
      return;
    }
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
    }
    persistTimer.current = setTimeout(() => {
      persistThreadsToStore(userIdRef.current, threads, isPremium).catch(() => undefined);
    }, 250);
    return () => {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
      }
    };
  }, [hydrated, isPremium, threads]);

  useEffect(() => {
    const next = dedupeThreads(threads);
    if (next.length !== threads.length) {
      setThreads(next);
    }
  }, [threads]);

  const updateThread = useCallback(
    (threadId: string, updater: (thread: ChatThread) => ChatThread) => {
      setThreads((current) =>
        current.map((thread) =>
          thread.id === threadId ? updater(thread) : thread
        )
      );
    },
    []
  );

  const getThread = useCallback(
    (id: string) => threads.find((thread) => thread.id === id),
    [threads]
  );

  const speakMessage = useCallback(
    (threadId: string, message: ChatBubble) => {
      const thread = threads.find((item) => item.id === threadId);
      if (!thread?.listen || message.from !== "them" || message.voice) {
        return;
      }
      if (inCallThreadId) {
        return;
      }
      setSpeakingId(message.id);
      ttsSpeak({ id: message.id, text: message.text }).finally(() => {
        setSpeakingId((current) => (current === message.id ? null : current));
      });
    },
    [inCallThreadId, threads]
  );

  const stopSpeaking = useCallback(() => {
    ttsStop();
    setSpeakingId(null);
  }, []);

  const setListen = useCallback(
    (threadId: string, listen: boolean) => {
      if (!listen) {
        stopSpeaking();
      }
      updateThread(threadId, (thread) => ({ ...thread, listen }));
      if (listen && !inCallThreadId) {
        setThreads((current) => {
          const thread = current.find((item) => item.id === threadId);
          const them = thread?.messages.filter(
            (item) => item.from === "them" && !item.voice
          );
          const last = them?.[them.length - 1];
          if (last) {
            setSpeakingId(last.id);
            ttsSpeak({ id: last.id, text: last.text }).finally(() => {
              setSpeakingId((id) => (id === last.id ? null : id));
            });
          }
          return current;
        });
      }
    },
    [inCallThreadId, stopSpeaking, updateThread]
  );

  const setPinned = useCallback(
    (threadId: string, pinned: boolean) => {
      updateThread(threadId, (thread) => ({ ...thread, pinned }));
    },
    [updateThread]
  );

  const setSynced = useCallback(
    (threadId: string, synced: boolean) => {
      updateThread(threadId, (thread) => ({ ...thread, synced }));
    },
    [updateThread]
  );

  const replyTo = useCallback(
    (threadId: string, text: string) => {
      const bubble: ChatBubble = { id: nextId(), from: "them", text };
      updateThread(threadId, (thread) => ({
        ...thread,
        preview: text,
        time: "Now",
        messages: [
          ...thread.messages,
          { ...bubble, synced: thread.synced || undefined },
        ],
      }));
      setTimeout(() => {
        setThreads((current) => {
          const thread = current.find((item) => item.id === threadId);
          if (thread?.listen && !inCallThreadId) {
            speakMessage(threadId, bubble);
          }
          return current;
        });
      }, 80);
    },
    [inCallThreadId, speakMessage, updateThread]
  );

  const clearChatNotice = useCallback((threadId: string) => {
    setChatNotices((current) => {
      if (!(threadId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[threadId];
      return next;
    });
  }, []);

  const requestBotReply = useCallback(
    (
      threadId: string,
      input: Parameters<typeof completeCompanionChat>[0],
      onSuccess: (text: string) => void
    ) => {
      // A reply that lands after the account changed belongs to the old
      // session: drop it instead of appending it to whoever is signed in now.
      const requestUserId = userIdRef.current;
      const stillCurrent = () => userIdRef.current === requestUserId;
      clearChatNotice(threadId);
      adjustPendingReply(threadId, 1);
      completeCompanionChat(input)
        .then((text) => {
          if (!stillCurrent()) {
            return;
          }
          clearChatNotice(threadId);
          onSuccess(text);
          adjustPendingReply(threadId, -1);
        })
        .catch((error) => {
          if (!stillCurrent()) {
            return;
          }
          setChatNotices((current) => ({
            ...current,
            [threadId]: companionChatErrorMessage(error),
          }));
          adjustPendingReply(threadId, -1);
        });
    },
    [adjustPendingReply, clearChatNotice]
  );

  const sendText = useCallback(
    (threadId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      updateThread(threadId, (thread) => ({
        ...thread,
        preview: trimmed,
        time: "Now",
        messages: [
          ...thread.messages,
          {
            id: nextId(),
            from: "me",
            text: trimmed,
            synced: thread.synced || undefined,
          },
        ],
      }));
      const thread = threads.find((item) => item.id === threadId);
      if (thread?.kind === "bot" || thread?.request === "accepted") {
        requestBotReply(
          threadId,
          {
            name: thread.name,
            userText: trimmed,
            history: thread.messages.map((item) => ({
              from: item.from,
              text: item.text,
            })),
            personality: thread.personality,
            story: thread.description,
          },
          (reply) => replyTo(threadId, reply)
        );
      }
    },
    [replyTo, requestBotReply, threads, updateThread]
  );

  const sendVoice = useCallback(
    (threadId: string) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        preview: "You sent a voice message",
        time: "Now",
        messages: [
          ...thread.messages,
          {
            id: nextId(),
            from: "me",
            text: "You sent a voice message",
            voice: true,
            synced: thread.synced || undefined,
          },
        ],
      }));
      const thread = threads.find((item) => item.id === threadId);
      if (thread?.kind === "bot" || thread?.request === "accepted") {
        requestBotReply(
          threadId,
          {
            name: thread.name,
            userText: "I sent you a voice note.",
            history: thread.messages.map((item) => ({
              from: item.from,
              text: item.text,
            })),
            personality: thread.personality,
            story: thread.description,
          },
          (reply) => replyTo(threadId, reply)
        );
      }
    },
    [replyTo, requestBotReply, threads, updateThread]
  );

  const editLastMine = useCallback(
    (threadId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      updateThread(threadId, (thread) => {
        const lastMine = [...thread.messages]
          .reverse()
          .find((item) => item.from === "me" && !item.voice);
        if (!lastMine) {
          return thread;
        }
        return {
          ...thread,
          preview: trimmed,
          messages: thread.messages.map((item) =>
            item.id === lastMine.id
              ? { ...item, text: trimmed, edited: true }
              : item
          ),
        };
      });
    },
    [updateThread]
  );

  const regenerate = useCallback(
    (threadId: string) => {
      const thread = threads.find((item) => item.id === threadId);
      if (!thread || (thread.kind !== "bot" && thread.request !== "accepted")) {
        return;
      }
      // Same rule the thread row uses to show the control: only the final,
      // finished companion reply can be regenerated, and never while another
      // reply is in flight (a double tap, or a send still waiting on Ark).
      const targetId = regenerateTargetId(
        thread.messages,
        isReplyPending(threadId)
      );
      if (!targetId) {
        return;
      }
      const earlier = thread.messages.slice(0, -1);
      const lastMine = [...earlier]
        .reverse()
        .find((item) => item.from === "me");
      if (!lastMine) {
        return;
      }
      requestBotReply(
        threadId,
        {
          name: thread.name,
          userText: lastMine.text,
          history: earlier.map((item) => ({
            from: item.from,
            text: item.text,
          })),
          personality: thread.personality,
          story: thread.description,
        },
        (text) => {
          updateThread(threadId, (current) => ({
            ...current,
            preview: text,
            messages: current.messages.map((item) =>
              item.id === targetId ? { ...item, text } : item
            ),
          }));
        }
      );
    },
    [isReplyPending, requestBotReply, threads, updateThread]
  );

  const chatNotice = useCallback(
    (threadId: string) => chatNotices[threadId],
    [chatNotices]
  );

  const replyPending = useCallback(
    (threadId: string) => (pendingReplies[threadId] ?? 0) > 0,
    [pendingReplies]
  );

  const setRequest = useCallback(
    (threadId: string, request: FriendRequest) => {
      updateThread(threadId, (thread) => {
        const preview =
          request === "accepted"
            ? "I have accepted your request. Let’s Chat!"
            : request === "sent"
            ? `Request resent. Waiting for ${thread.name} to respond.`
            : request === "incoming"
            ? `${thread.name} wants to chat`
            : thread.preview;
        const messages =
          request === "accepted"
            ? [
                {
                  id: nextId(),
                  from: "them" as const,
                  text: "I have accepted your request. Let’s Chat!",
                },
              ]
            : thread.messages;
        return { ...thread, request, preview, time: "Now", messages };
      });
    },
    [updateThread]
  );

  const sendFriendRequest = useCallback(
    (person: DirectoryPerson) => {
      const existing = threads.find((thread) => thread.id === person.id);
      if (existing) {
        setRequest(existing.id, "sent");
        return existing.id;
      }
      const id = person.id;
      setThreads((current) => [
        {
          id,
          name: person.name,
          kind: "human",
          email: person.email,
          preview: `Waiting for ${person.name} to respond`,
          time: "Now",
          pinned: false,
          listen: false,
          synced: false,
          request: "sent",
          gender: person.gender,
          birthday: person.birthday,
          messages: [
            {
              id: nextId(),
              from: "me",
              text: "Chat request sent.",
            },
          ],
        },
        ...current,
      ]);
      return id;
    },
    [setRequest, threads]
  );

  // Chat is local-only (on-device store, no GraphQL chat API). Dropping the
  // thread here is the whole cancel; the persist effect writes it through.
  const cancelFriendRequest = useCallback((threadId: string) => {
    setThreads((current) =>
      current.filter((thread) => thread.id !== threadId)
    );
  }, []);

  const createBot = useCallback(
    (input: {
      name: string;
      gender: string;
      birthday: string;
      description: string;
    }) => {
      const name = input.name.trim() || "Kevin";
      let createdId = defaultBotIdForName(name) ?? `bot-${nextId()}`;
      setThreads((current) => {
        const existing = findSameBot(current, createdId, name);
        if (existing) {
          createdId = existing.id;
          return current.map((thread) =>
            thread.id === existing.id
              ? {
                  ...thread,
                  name,
                  gender: input.gender,
                  birthday: input.birthday,
                  description: input.description,
                  time: "Now",
                }
              : thread
          );
        }
        return [
          {
            id: createdId,
            name,
            kind: "bot" as const,
            preview: `Start chatting with ${name}.`,
            time: "Now",
            pinned: false,
            listen: false,
            synced: false,
            request: "none" as const,
            gender: input.gender,
            birthday: input.birthday,
            description: input.description,
            messages: [
              {
                id: nextId(),
                from: "them" as const,
                text: `Hey, it's ${name}. Start whenever you're ready.`,
              },
            ],
          },
          ...current,
        ];
      });
      return createdId;
    },
    []
  );

  const updateBot = useCallback(
    (
      threadId: string,
      input: {
        name: string;
        gender: string;
        birthday: string;
        description: string;
        personality?: string;
      }
    ) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        name: input.name.trim() || thread.name,
        gender: input.gender,
        birthday: input.birthday,
        description: input.description,
        personality: input.personality ?? thread.personality,
        preview: thread.preview,
        time: "Now",
      }));
    },
    [updateThread]
  );

  const upsertCompanionThread = useCallback(
    (companion: {
      id: string;
      name: string;
      gender: string;
      birthday: string;
      personalities: string[];
      story: string;
    }) => {
      const name = companion.name.trim() || "Kevin";
      const personality = companion.personalities.join(", ");
      setThreads((current) => {
        const existing = findSameBot(current, companion.id, name);
        if (existing) {
          return current.map((thread) =>
            thread.id === existing.id
              ? {
                  ...thread,
                  name,
                  gender: companion.gender,
                  birthday: companion.birthday,
                  description: companion.story,
                  personality,
                  time: "Now",
                }
              : thread
          );
        }
        return [
          {
            id: companion.id,
            name,
            kind: "bot" as const,
            preview: `Start chatting with ${name}.`,
            time: "Now",
            pinned: false,
            listen: false,
            synced: false,
            request: "none" as const,
            gender: companion.gender,
            birthday: companion.birthday,
            description: companion.story,
            personality,
            messages: [
              {
                id: nextId(),
                from: "them" as const,
                text: `Hey, it's ${name}. Start whenever you're ready.`,
              },
            ],
          },
          ...current,
        ];
      });
    },
    []
  );

  const humanLimitReached = useCallback(
    (thread: ChatThread) => {
      if (isPremium || thread.kind !== "human" || thread.request !== "accepted") {
        return false;
      }
      const mine = thread.messages.filter((item) => item.from === "me").length;
      return mine >= FREE_HUMAN_MESSAGE_LIMIT;
    },
    [isPremium]
  );

  const value = useMemo(
    () => ({
      threads,
      directory,
      isPremium,
      speakingId,
      inCallThreadId,
      getThread,
      setListen,
      setPinned,
      setSynced,
      sendText,
      sendVoice,
      editLastMine,
      regenerate,
      speakMessage,
      stopSpeaking,
      setRequest,
      sendFriendRequest,
      cancelFriendRequest,
      setPremium: setIsPremium,
      setInCall: setInCallThreadId,
      createBot,
      updateBot,
      upsertCompanionThread,
      humanLimitReached,
      chatNotice,
      replyPending,
    }),
    [
      cancelFriendRequest,
      chatNotice,
      createBot,
      updateBot,
      upsertCompanionThread,
      directory,
      editLastMine,
      getThread,
      humanLimitReached,
      inCallThreadId,
      isPremium,
      regenerate,
      replyPending,
      sendFriendRequest,
      sendText,
      sendVoice,
      setListen,
      setPinned,
      setRequest,
      setSynced,
      speakMessage,
      speakingId,
      stopSpeaking,
      threads,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};
