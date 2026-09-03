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
import { subscribeSessionUser } from "../../backend/session";
import {
  LiveLoveSession,
  emptyLoveSession,
  liveFromPersisted,
  shouldReuseLoveChat,
} from "./session-logic";
import {
  initialLoveSessionFromBoot,
  loadLoveSessionForUser,
  saveLoveSessionForUser,
} from "./session-persist";
import { LoveChatItem, LoveChatState, LoveLayer } from "./types";
import type { LoveStackSurface } from "./stack";

type StartOptions = {
  layer: LoveLayer;
  surface?: LoveStackSurface;
  companionId?: string;
  name?: string;
  personality?: string;
  story?: string;
  messages?: LoveChatItem[];
  fromCreation?: boolean;
  syncing?: boolean;
  keepLayer?: boolean;
  replace?: boolean;
};

type LoveTimerLayer = Extract<LoveLayer, "call" | "sync">;

type LoveSessionValue = {
  companionId?: string;
  layer: LoveLayer | null;
  minimized: boolean;
  surface: LoveStackSurface;
  chat: LoveChatState | null;
  callStartedAt: number | null;
  syncStartedAt: number | null;
  start: (options: StartOptions) => void;
  patchChat: (
    update: Partial<LoveChatState> | ((current: LoveChatState) => LoveChatState)
  ) => void;
  minimize: () => void;
  restore: () => void;
  end: () => void;
  ensureLayerTimer: (layer: LoveTimerLayer, startedAt?: number) => void;
  clearLayerTimer: (layer: LoveTimerLayer) => void;
};

const LoveSessionContext = createContext<LoveSessionValue | null>(null);

const nextId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export const seedLoveChat = ({
  companionId,
  name = "Kevin",
  personality,
  story,
  messages: existingMessages,
  fromCreation = false,
  syncing = false,
}: {
  companionId?: string;
  name?: string;
  personality?: string;
  story?: string;
  messages?: LoveChatItem[];
  fromCreation?: boolean;
  syncing?: boolean;
}): LoveChatState => {
  const messages =
    existingMessages && existingMessages.length > 0
      ? existingMessages
      : fromCreation
      ? [
          {
            kind: "bubble" as const,
            id: nextId(),
            from: "them" as const,
            text: `Start chatting with ${name}.`,
          },
        ]
      : syncing
      ? [
          {
            kind: "bubble" as const,
            id: nextId(),
            from: "them" as const,
            text: `Hey, it's ${name}. Want to sync?`,
          },
          { kind: "sync" as const, id: nextId() },
        ]
      : [
          {
            kind: "bubble" as const,
            id: nextId(),
            from: "them" as const,
            text: `Hey, it's ${name}. I'm here.`,
          },
        ];

  return {
    companionId,
    name,
    personality,
    story,
    messages,
    synced: syncing,
    inCall: false,
    listen: false,
    pinned: true,
    mode: "none",
  };
};

const applyToChats = (
  chats: Record<string, LoveChatState>,
  chat: LoveChatState | null
) => {
  if (chat?.companionId) {
    chats[chat.companionId] = chat;
  }
};

export const LoveSessionProvider = ({ children }: { children: ReactNode }) => {
  const boot = initialLoveSessionFromBoot();
  const [companionId, setCompanionId] = useState<string | undefined>(
    boot.live.companionId
  );
  const [layer, setLayer] = useState<LoveLayer | null>(boot.live.layer);
  const [minimized, setMinimized] = useState(boot.live.minimized);
  const [surface, setSurface] = useState<LoveStackSurface>(boot.live.surface);
  const [chat, setChat] = useState<LoveChatState | null>(boot.live.chat);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(
    boot.live.callStartedAt
  );
  const [syncStartedAt, setSyncStartedAt] = useState<number | null>(
    boot.live.syncStartedAt
  );
  const [userId, setUserId] = useState<string | null>(boot.userId);
  const [hydrated, setHydrated] = useState(boot.ready);
  const chatsByCompanionId = useRef<Record<string, LoveChatState>>(
    boot.live.chat?.companionId
      ? { [boot.live.chat.companionId]: boot.live.chat }
      : {}
  );
  const loadedUserIdRef = useRef<string | null | undefined>(
    boot.ready ? boot.userId : undefined
  );

  const applyLive = useCallback((next: LiveLoveSession) => {
    setCompanionId(next.companionId);
    setLayer(next.layer);
    setMinimized(next.minimized);
    setSurface(next.surface);
    setChat(next.chat);
    setCallStartedAt(next.callStartedAt);
    setSyncStartedAt(next.syncStartedAt);
    chatsByCompanionId.current = {};
    applyToChats(chatsByCompanionId.current, next.chat);
  }, []);

  useEffect(() => {
    return subscribeSessionUser((user) => {
      const nextId = user?.id ?? null;
      if (loadedUserIdRef.current === nextId) {
        return;
      }
      loadedUserIdRef.current = nextId;
      setUserId(nextId);
      setHydrated(false);
      applyLive(emptyLoveSession());
      if (!nextId) {
        setHydrated(true);
        return;
      }
      loadLoveSessionForUser(nextId)
        .then((parsed) => {
          if (loadedUserIdRef.current !== nextId) {
            return;
          }
          applyLive(liveFromPersisted(parsed));
        })
        .catch(() => {
          if (loadedUserIdRef.current !== nextId) {
            return;
          }
          applyLive(emptyLoveSession());
        })
        .finally(() => {
          if (loadedUserIdRef.current === nextId) {
            setHydrated(true);
          }
        });
    });
  }, [applyLive]);

  useEffect(() => {
    if (!hydrated || !userId) {
      return;
    }
    saveLoveSessionForUser(userId, {
      companionId,
      layer,
      minimized,
      surface,
      chat,
      callStartedAt,
      syncStartedAt,
    }).catch(() => undefined);
  }, [
    callStartedAt,
    chat,
    companionId,
    hydrated,
    layer,
    minimized,
    surface,
    syncStartedAt,
    userId,
  ]);

  const start = useCallback((options: StartOptions) => {
    setMinimized(false);
    if (options.surface) {
      setSurface(options.surface);
    }
    if (options.companionId) {
      setCompanionId(options.companionId);
    }
    setLayer((current) => {
      if (options.keepLayer && current) {
        return current;
      }
      return options.layer;
    });
    setChat((current) => {
      if (current?.companionId) {
        chatsByCompanionId.current[current.companionId] = current;
      }
      const reuse = shouldReuseLoveChat({
        currentCompanionId: current?.companionId,
        nextCompanionId: options.companionId,
        replace: options.replace,
      });
      if (current && reuse) {
        return {
          ...current,
          name: options.name ?? current.name,
          personality: options.personality ?? current.personality,
          story: options.story ?? current.story,
          companionId: options.companionId ?? current.companionId,
          synced: options.layer === "sync" ? true : current.synced,
          inCall: options.layer === "call" ? true : current.inCall,
        };
      }
      const saved =
        !options.replace &&
        !options.fromCreation &&
        options.companionId
          ? chatsByCompanionId.current[options.companionId]
          : undefined;
      const next = saved
        ? {
            ...saved,
            name: options.name ?? saved.name,
            personality: options.personality ?? saved.personality,
            story: options.story ?? saved.story,
            companionId: options.companionId,
            synced: options.syncing || options.layer === "sync" ? true : saved.synced,
            inCall: options.layer === "call" ? true : saved.inCall,
          }
        : {
            ...seedLoveChat({
              companionId: options.companionId,
              name: options.name,
              personality: options.personality,
              story: options.story,
              messages: options.messages,
              fromCreation: options.fromCreation,
              syncing: options.syncing || options.layer === "sync",
            }),
            // Same rule as the reuse / saved branches above: opening the
            // call layer is what puts the chat in a call.
            inCall: options.layer === "call",
          };
      if (next.companionId) {
        chatsByCompanionId.current[next.companionId] = next;
      }
      return next;
    });
    if (options.replace) {
      setCallStartedAt(null);
      setSyncStartedAt(null);
    }
  }, []);

  const patchChat = useCallback(
    (
      update:
        | Partial<LoveChatState>
        | ((current: LoveChatState) => LoveChatState)
    ) => {
      setChat((current) => {
        if (!current) {
          return current;
        }
        return typeof update === "function"
          ? update(current)
          : { ...current, ...update };
      });
    },
    []
  );

  const minimize = useCallback(() => {
    setMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setMinimized(false);
  }, []);

  const ensureLayerTimer = useCallback((
    nextLayer: LoveTimerLayer,
    startedAt?: number
  ) => {
    const fallback = startedAt ?? Date.now();
    switch (nextLayer) {
      case "call":
        setCallStartedAt((current) => current ?? fallback);
        return;
      case "sync":
        setSyncStartedAt((current) => current ?? fallback);
        return;
      default: {
        const exhaustive: never = nextLayer;
        return exhaustive;
      }
    }
  }, []);

  const clearLayerTimer = useCallback((nextLayer: LoveTimerLayer) => {
    switch (nextLayer) {
      case "call":
        setCallStartedAt(null);
        return;
      case "sync":
        setSyncStartedAt(null);
        return;
      default: {
        const exhaustive: never = nextLayer;
        return exhaustive;
      }
    }
  }, []);

  const end = useCallback(() => {
    setCompanionId(undefined);
    setLayer(null);
    setMinimized(false);
    setSurface("love");
    setChat(null);
    setCallStartedAt(null);
    setSyncStartedAt(null);
    const id = loadedUserIdRef.current;
    if (typeof id === "string" && id.length > 0) {
      saveLoveSessionForUser(id, emptyLoveSession()).catch(() => undefined);
    }
  }, []);

  const value = useMemo(
    () => ({
      companionId,
      layer,
      minimized,
      surface,
      chat,
      callStartedAt,
      syncStartedAt,
      start,
      patchChat,
      minimize,
      restore,
      end,
      ensureLayerTimer,
      clearLayerTimer,
    }),
    [
      callStartedAt,
      chat,
      clearLayerTimer,
      companionId,
      end,
      ensureLayerTimer,
      layer,
      minimize,
      minimized,
      patchChat,
      restore,
      start,
      surface,
      syncStartedAt,
    ]
  );

  return (
    <LoveSessionContext.Provider value={value}>
      {children}
    </LoveSessionContext.Provider>
  );
};

export const useLoveSession = () => {
  const context = useContext(LoveSessionContext);
  if (!context) {
    throw new Error("useLoveSession must be used within LoveSessionProvider");
  }
  return context;
};
