import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AvatarLook, pickLook } from "../screens/avatar/engine/viewer-html";

const STORAGE_KEY = "ph.companions.v1";

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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as {
          companions?: Companion[];
          activeCompanionId?: string | null;
        };
        if (Array.isArray(parsed.companions)) {
          setCompanions(parsed.companions);
        }
        if (parsed.activeCompanionId !== undefined) {
          setActiveCompanionId(parsed.activeCompanionId);
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ companions, activeCompanionId })
    ).catch(() => undefined);
  }, [activeCompanionId, companions, hydrated]);

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
      addCompanion,
      upsertCompanion,
      updateCompanion,
      setActiveCompanionId,
    }),
    [companions, activeCompanion]
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
