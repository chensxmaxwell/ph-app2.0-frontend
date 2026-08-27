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
import { companionChatOrFallback } from "../../services/llm";
import { nextRegeneratedReply } from "../love/replies";
import client from "../../apolloClient";
import {
  CHAT_THREADS,
  DELETE_CHAT_THREAD,
  PUT_RECORD,
  SETTINGS_RECORDS,
  UPSERT_CHAT_THREAD,
} from "../../backend/operations";
import { seedDirectory, seedThreads } from "../../backend/chat-seed";
import { subscribeSessionUser } from "../../backend/session";
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
};


const threadToInput = (thread: ChatThread) => ({
  id: thread.id,
  name: thread.name,
  kind: thread.kind,
  email: thread.email,
  preview: thread.preview,
  time: thread.time,
  pinned: thread.pinned,
  listen: thread.listen,
  synced: thread.synced,
  request: thread.request,
  gender: thread.gender,
  birthday: thread.birthday,
  description: thread.description,
  personality: thread.personality,
  messages: thread.messages.map((item) => ({
    id: item.id,
    from: item.from,
    text: item.text,
    voice: item.voice === true,
    edited: item.edited === true,
    synced: item.synced === true,
  })),
});

const threadFromGql = (thread: any): ChatThread => ({
  id: thread.id,
  name: thread.name || "",
  kind: thread.kind === "human" ? "human" : "bot",
  email: thread.email || undefined,
  preview: thread.preview || "",
  time: thread.time || "",
  pinned: !!thread.pinned,
  listen: !!thread.listen,
  synced: !!thread.synced,
  request: (thread.request || "none") as FriendRequest,
  gender: thread.gender || undefined,
  birthday: thread.birthday || undefined,
  description: thread.description || undefined,
  personality: thread.personality || undefined,
  messages: Array.isArray(thread.messages)
    ? thread.messages.map((item: any) => ({
        id: item.id,
        from: item.from === "me" ? "me" : "them",
        text: item.text || "",
        voice: item.voice === true ? true : undefined,
        edited: item.edited === true ? true : undefined,
        synced: item.synced === true ? true : undefined,
      }))
    : [],
});

const loadThreadsFromBackend = async (): Promise<{
  threads: ChatThread[];
  isPremium: boolean;
}> => {
  const [threadResult, settingsResult] = await Promise.all([
    client.query({ query: CHAT_THREADS, fetchPolicy: "no-cache" }),
    client.query({
      query: SETTINGS_RECORDS,
      variables: { kind: "settings" },
      fetchPolicy: "no-cache",
    }),
  ]);
  const threads = Array.isArray(threadResult.data?.chatThreads)
    ? threadResult.data.chatThreads.map(threadFromGql)
    : [];
  const premium = (settingsResult.data?.records || []).find(
    (item: { id?: string }) => item.id === "premium"
  );
  let isPremium = false;
  if (premium?.payload) {
    try {
      isPremium = !!JSON.parse(premium.payload).isPremium;
    } catch {
      isPremium = false;
    }
  }
  return { threads: mergeSeedThreads(dedupeThreads(threads)), isPremium };
};

const persistThreadsToBackend = async (
  threads: ChatThread[],
  isPremium: boolean
) => {
  const remote = await client.query({
    query: CHAT_THREADS,
    fetchPolicy: "no-cache",
  });
  const remoteIds = new Set(
    (remote.data?.chatThreads || []).map((item: { id: string }) => item.id)
  );
  const nextIds = new Set(threads.map((item) => item.id));
  await Promise.all(
    Array.from(remoteIds)
      .filter((id) => !nextIds.has(id))
      .map((id) =>
        client.mutate({ mutation: DELETE_CHAT_THREAD, variables: { id } })
      )
  );
  await Promise.all(
    threads.map((thread) =>
      client.mutate({
        mutation: UPSERT_CHAT_THREAD,
        variables: { input: threadToInput(thread) },
      })
    )
  );
  await client.mutate({
    mutation: PUT_RECORD,
    variables: {
      kind: "settings",
      id: "premium",
      payload: JSON.stringify({ isPremium }),
    },
  });
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
        setIsPremium(false);
        setHydrated(true);
        return;
      }
      loadThreadsFromBackend()
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
  }, []);

  useEffect(() => {
    if (!hydrated || !userIdRef.current) {
      return;
    }
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
    }
    persistTimer.current = setTimeout(() => {
      persistThreadsToBackend(threads, isPremium).catch(() => undefined);
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
        companionChatOrFallback({
          name: thread.name,
          userText: trimmed,
          history: thread.messages.map((item) => ({
            from: item.from,
            text: item.text,
          })),
          personality: thread.personality,
          story: thread.description,
        }).then((reply) => replyTo(threadId, reply));
      }
    },
    [replyTo, threads, updateThread]
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
        companionChatOrFallback({
          name: thread.name,
          userText: "I sent you a voice note.",
          history: thread.messages.map((item) => ({
            from: item.from,
            text: item.text,
          })),
          personality: thread.personality,
          story: thread.description,
        }).then((reply) => replyTo(threadId, reply));
      }
    },
    [replyTo, threads, updateThread]
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
      updateThread(threadId, (thread) => {
        const lastThem = [...thread.messages]
          .reverse()
          .find((item) => item.from === "them");
        if (!lastThem) {
          return thread;
        }
        const next = nextRegeneratedReply(lastThem.text);
        return {
          ...thread,
          preview: next,
          messages: thread.messages.map((item) =>
            item.id === lastThem.id ? { ...item, text: next } : item
          ),
        };
      });
    },
    [updateThread]
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

  const cancelFriendRequest = useCallback((threadId: string) => {
    setThreads((current) =>
      current.filter((thread) => thread.id !== threadId)
    );
    client
      .mutate({ mutation: DELETE_CHAT_THREAD, variables: { id: threadId } })
      .catch(() => undefined);
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
    }),
    [
      cancelFriendRequest,
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
