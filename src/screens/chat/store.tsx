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
  setUnread: (threadId: string, unread: boolean) => void;
  deleteThread: (threadId: string) => void;
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
};


const loadThreadsFromStore = async (userId: string): Promise<{
  threads: ChatThread[];
  isPremium: boolean;
  deletedThreadIds: string[];
}> => {
  const blob = await loadChat(userId);
  const threads = Array.isArray(blob.threads) ? blob.threads : [];
  const deletedThreadIds = Array.isArray(blob.deletedThreadIds)
    ? blob.deletedThreadIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    : [];
  return {
    threads: mergeSeedThreads(dedupeThreads(threads), deletedThreadIds),
    isPremium: !!blob.isPremium,
    deletedThreadIds,
  };
};

const persistThreadsToStore = async (
  userId: string,
  threads: ChatThread[],
  isPremium: boolean,
  deletedThreadIds: string[]
) => {
  await saveChat(userId, { threads, isPremium, deletedThreadIds });
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

const mergeSeedThreads = (
  stored: ChatThread[],
  deletedThreadIds: string[] = []
) => {
  const seeds = seedThreads();
  const deleted = new Set(deletedThreadIds);
  const byId = new Map(stored.map((thread) => [thread.id, thread]));
  for (const seed of seeds) {
    const existing = byId.get(seed.id);
    if (!existing) {
      // A seeded bot the user deleted from the Message list stays deleted.
      if (!deleted.has(seed.id)) {
        byId.set(seed.id, seed);
      }
      continue;
    }
    if (!existing.messages.length && seed.messages.length) {
      byId.set(seed.id, {
        ...existing,
        preview: existing.preview || seed.preview,
        lastActivityAt: seed.lastActivityAt,
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
  const [deletedThreadIds, setDeletedThreadIds] = useState<string[]>([]);
  const [directory] = useState<DirectoryPerson[]>(seedDirectory);
  const [isPremium, setIsPremium] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [inCallThreadId, setInCallThreadId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [chatNotices, setChatNotices] = useState<Record<string, string>>({});

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSessionUser((user) => {
      const nextId = user?.id ?? null;
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      userIdRef.current = nextId;
      setHydrated(false);
      if (!nextId) {
        setThreads(seedThreads());
        setDeletedThreadIds([]);
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
          // Seeds are already merged in; an empty list means every seeded
          // bot was deleted and must not come back.
          setThreads(loaded.threads);
          setDeletedThreadIds(loaded.deletedThreadIds);
          setIsPremium(loaded.isPremium);
        })
        .catch(() => {
          if (userIdRef.current === nextId) {
            setThreads(seedThreads());
            setDeletedThreadIds([]);
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
  }, []);

  useEffect(() => {
    const userId = userIdRef.current;
    if (!hydrated || !userId) {
      return;
    }
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
    }
    persistTimer.current = setTimeout(() => {
      persistThreadsToStore(userId, threads, isPremium, deletedThreadIds).catch(
        () => undefined
      );
    }, 250);
    return () => {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
      }
    };
  }, [deletedThreadIds, hydrated, isPremium, threads]);

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

  const setUnread = useCallback(
    (threadId: string, unread: boolean) => {
      updateThread(threadId, (thread) =>
        !!thread.unread === unread ? thread : { ...thread, unread }
      );
    },
    [updateThread]
  );

  // "Delete friend" on the Message list. Chat is local-only, so dropping the
  // thread is the whole delete; the id is remembered so a seeded bot is not
  // merged back in on the next hydrate.
  const deleteThread = useCallback(
    (threadId: string) => {
      const thread = threads.find((item) => item.id === threadId);
      if (thread?.messages.some((message) => message.id === speakingId)) {
        stopSpeaking();
      }
      if (inCallThreadId === threadId) {
        setInCallThreadId(null);
      }
      setThreads((current) => current.filter((item) => item.id !== threadId));
      setDeletedThreadIds((current) =>
        current.includes(threadId) ? current : [...current, threadId]
      );
    },
    [inCallThreadId, speakingId, stopSpeaking, threads]
  );

  const replyTo = useCallback(
    (threadId: string, text: string) => {
      const sentAt = Date.now();
      const bubble: ChatBubble = { id: nextId(), from: "them", text, sentAt };
      updateThread(threadId, (thread) => ({
        ...thread,
        preview: text,
        lastActivityAt: sentAt,
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
      clearChatNotice(threadId);
      completeCompanionChat(input)
        .then((text) => {
          clearChatNotice(threadId);
          onSuccess(text);
        })
        .catch((error) => {
          setChatNotices((current) => ({
            ...current,
            [threadId]: companionChatErrorMessage(error),
          }));
        });
    },
    [clearChatNotice]
  );

  const sendText = useCallback(
    (threadId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      const sentAt = Date.now();
      updateThread(threadId, (thread) => ({
        ...thread,
        preview: trimmed,
        lastActivityAt: sentAt,
        messages: [
          ...thread.messages,
          {
            id: nextId(),
            from: "me",
            text: trimmed,
            sentAt,
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
      const sentAt = Date.now();
      updateThread(threadId, (thread) => ({
        ...thread,
        preview: "You sent a voice message",
        lastActivityAt: sentAt,
        messages: [
          ...thread.messages,
          {
            id: nextId(),
            from: "me",
            text: "You sent a voice message",
            sentAt,
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
      const lastThem = [...thread.messages]
        .reverse()
        .find((item) => item.from === "them");
      const lastMine = [...thread.messages]
        .reverse()
        .find((item) => item.from === "me");
      if (!lastMine) {
        return;
      }
      const history = lastThem
        ? thread.messages.filter((item) => item.id !== lastThem.id)
        : thread.messages;
      requestBotReply(
        threadId,
        {
          name: thread.name,
          userText: lastMine.text,
          history: history.map((item) => ({
            from: item.from,
            text: item.text,
          })),
          personality: thread.personality,
          story: thread.description,
        },
        (text) => {
          if (!lastThem) {
            replyTo(threadId, text);
            return;
          }
          updateThread(threadId, (current) => ({
            ...current,
            preview: text,
            messages: current.messages.map((item) =>
              item.id === lastThem.id ? { ...item, text } : item
            ),
          }));
        }
      );
    },
    [replyTo, requestBotReply, threads, updateThread]
  );

  const chatNotice = useCallback(
    (threadId: string) => chatNotices[threadId],
    [chatNotices]
  );

  const setRequest = useCallback(
    (threadId: string, request: FriendRequest) => {
      const at = Date.now();
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
                  sentAt: at,
                },
              ]
            : thread.messages;
        return { ...thread, request, preview, lastActivityAt: at, messages };
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
      const sentAt = Date.now();
      setThreads((current) => [
        {
          id,
          name: person.name,
          kind: "human",
          email: person.email,
          preview: `Waiting for ${person.name} to respond`,
          lastActivityAt: sentAt,
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
              sentAt,
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
      // Editing a persona is not chat activity: the Message row keeps the
      // time of the last message instead of jumping to "now".
      updateThread(threadId, (thread) => ({
        ...thread,
        name: input.name.trim() || thread.name,
        gender: input.gender,
        birthday: input.birthday,
        description: input.description,
        personality: input.personality ?? thread.personality,
        preview: thread.preview,
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
      const createdAt = Date.now();
      setThreads((current) => {
        const existing = findSameBot(current, companion.id, name);
        if (existing) {
          // Saving an edited look / persona keeps the last message's time.
          return current.map((thread) =>
            thread.id === existing.id
              ? {
                  ...thread,
                  name,
                  gender: companion.gender,
                  birthday: companion.birthday,
                  description: companion.story,
                  personality,
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
            lastActivityAt: createdAt,
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
                sentAt: createdAt,
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
      setUnread,
      deleteThread,
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
      updateBot,
      upsertCompanionThread,
      humanLimitReached,
      chatNotice,
    }),
    [
      cancelFriendRequest,
      chatNotice,
      deleteThread,
      updateBot,
      upsertCompanionThread,
      directory,
      editLastMine,
      getThread,
      humanLimitReached,
      inCallThreadId,
      isPremium,
      regenerate,
      sendFriendRequest,
      sendText,
      sendVoice,
      setListen,
      setPinned,
      setRequest,
      setSynced,
      setUnread,
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
