import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { LoveChatState, LoveLayer } from "./types";

type StartOptions = {
  layer: LoveLayer;
  companionId?: string;
  name?: string;
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
  fromCreation = false,
  syncing = false,
}: {
  companionId?: string;
  name?: string;
  fromCreation?: boolean;
  syncing?: boolean;
}): LoveChatState => {
  const messages = fromCreation
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
    messages,
    synced: syncing,
    inCall: false,
    listen: false,
    pinned: true,
    mode: "none",
  };
};

export const LoveSessionProvider = ({ children }: { children: ReactNode }) => {
  const [companionId, setCompanionId] = useState<string | undefined>();
  const [layer, setLayer] = useState<LoveLayer | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [chat, setChat] = useState<LoveChatState | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [syncStartedAt, setSyncStartedAt] = useState<number | null>(null);

  const start = useCallback((options: StartOptions) => {
    setMinimized(false);
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
      const sameCompanion =
        current &&
        (!options.companionId ||
          !current.companionId ||
          current.companionId === options.companionId);
      if (current && sameCompanion && !options.replace) {
        return {
          ...current,
          name: options.name ?? current.name,
          companionId: options.companionId ?? current.companionId,
          synced: options.layer === "sync" ? true : current.synced,
          inCall: options.layer === "call" ? true : current.inCall,
        };
      }
      return seedLoveChat({
        companionId: options.companionId,
        name: options.name,
        fromCreation: options.fromCreation,
        syncing: options.syncing || options.layer === "sync",
      });
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
    setChat(null);
    setCallStartedAt(null);
    setSyncStartedAt(null);
  }, []);

  const value = useMemo(
    () => ({
      companionId,
      layer,
      minimized,
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
