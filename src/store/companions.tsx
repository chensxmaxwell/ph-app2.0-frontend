import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AvatarLook, pickLook } from "../screens/avatar/engine/viewer-html";
import {
  STORE_KEYS,
  subscribeSessionUser,
} from "../backend/session";
import {
  loadCompanions,
  saveCompanions,
} from "../backend/store";

export type Companion = AvatarLook & {
  id: string;
  name: string;
  birthday: string;
  gender: string;
  personalities: string[];
  story: string;
  passionateTender: number;
  dominantSubmissive: number;
  experimentalVanilla: number;
};

type CompanionsContextValue = {
  companions: Companion[];
  activeCompanion: Companion | null;
  activeCompanionId: string | null;
  addCompanion: (companion: Companion) => void;
  upsertCompanion: (companion: Companion) => void;
  updateCompanion: (id: string, patch: Partial<Companion>) => void;
  setActiveCompanionId: (id: string | null) => void;
};

const CompanionsContext = createContext<CompanionsContextValue | null>(null);

const mergeCompanion = (
  current: Companion[],
  companion: Companion
): Companion[] => {
  const index = current.findIndex((item) => item.id === companion.id);
  if (index === -1) {
    return [...current, companion];
  }
  const next = [...current];
  next[index] = { ...current[index], ...companion, id: companion.id };
  return next;
};

export const CompanionsProvider = ({ children }: { children: ReactNode }) => {
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [activeCompanionId, setActiveCompanionId] = useState<string | null>(
    null
  );
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSessionUser((user) => {
      const nextId = user?.id ?? null;
      setUserId(nextId);
      setHydrated(false);
      if (!nextId) {
        setCompanions([]);
        setActiveCompanionId(null);
        return;
      }
      loadCompanions(nextId)
        .then((parsed) => {
          if (Array.isArray(parsed.companions)) {
            setCompanions(parsed.companions as Companion[]);
          } else {
            setCompanions([]);
          }
          setActiveCompanionId(parsed.activeCompanionId ?? null);
        })
        .catch(() => {
          setCompanions([]);
          setActiveCompanionId(null);
        })
        .finally(() => setHydrated(true));
    });
  }, []);

  useEffect(() => {
    if (!hydrated || !userId) {
      return;
    }
    saveCompanions(userId, { companions, activeCompanionId }).catch(
      () => undefined
    );
  }, [activeCompanionId, companions, hydrated, userId]);

  const activeCompanion =
    companions.find((companion) => companion.id === activeCompanionId) ?? null;

  const upsertCompanion = (companion: Companion) => {
    setCompanions((current) => mergeCompanion(current, companion));
    setActiveCompanionId(companion.id);
  };

  const addCompanion = (companion: Companion) => {
    upsertCompanion(companion);
  };

  const updateCompanion = (id: string, patch: Partial<Companion>) => {
    setCompanions((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch, id } : item
      )
    );
  };

  const value = useMemo(
    () => ({
      companions,
      activeCompanion,
      activeCompanionId,
      addCompanion,
      upsertCompanion,
      updateCompanion,
      setActiveCompanionId,
    }),
    [activeCompanion, activeCompanionId, companions]
  );

  return (
    <CompanionsContext.Provider value={value}>
      {children}
    </CompanionsContext.Provider>
  );
};

export const useCompanions = () => {
  const context = useContext(CompanionsContext);
  if (!context) {
    throw new Error("useCompanions must be used within CompanionsProvider");
  }
  return context;
};

export const lookFromCompanion = (companion: Companion): AvatarLook =>
  pickLook(companion);
