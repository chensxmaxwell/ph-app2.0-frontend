import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AvatarLook, pickLook } from "../screens/avatar/engine/viewer-html";
import client from "../apolloClient";
import { COMPANIONS, PUT_RECORD, SETTINGS_RECORDS, UPSERT_COMPANION } from "../backend/operations";
import { subscribeSessionUser } from "../backend/session";

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

  const companionFromRow = (row: any): Companion | null => {
    if (row?.payload) {
      try {
        return JSON.parse(row.payload) as Companion;
      } catch {
        // fall through
      }
    }
    if (!row?.id) {
      return null;
    }
    return row as Companion;
  };

  useEffect(() => {
    const unsubscribe = subscribeSessionUser((user) => {
      setHydrated(false);
      if (!user?.id) {
        setCompanions([]);
        setActiveCompanionId(null);
        setHydrated(true);
        return;
      }
      Promise.all([
        client.query({ query: COMPANIONS, fetchPolicy: "no-cache" }),
        client.query({
          query: SETTINGS_RECORDS,
          variables: { kind: "settings" },
          fetchPolicy: "no-cache",
        }),
      ])
        .then(([companionResult, settingsResult]) => {
          const rows = companionResult.data?.companions || [];
          const parsed = rows
            .map(companionFromRow)
            .filter(Boolean) as Companion[];
          setCompanions(parsed);
          const active = (settingsResult.data?.records || []).find(
            (item: { id?: string }) => item.id === "activeCompanionId"
          );
          if (active?.payload) {
            setActiveCompanionId(active.payload);
          } else {
            setActiveCompanionId(null);
          }
        })
        .catch(() => {
          setCompanions([]);
          setActiveCompanionId(null);
        })
        .finally(() => setHydrated(true));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    client
      .mutate({
        mutation: PUT_RECORD,
        variables: {
          kind: "settings",
          id: "activeCompanionId",
          payload: activeCompanionId || "",
        },
      })
      .catch(() => undefined);
  }, [activeCompanionId, hydrated]);

  const activeCompanion =
    companions.find((companion) => companion.id === activeCompanionId) ?? null;

  const upsertCompanion = (companion: Companion) => {
    setCompanions((current) => mergeCompanion(current, companion));
    setActiveCompanionId(companion.id);
    client
      .mutate({
        mutation: UPSERT_COMPANION,
        variables: {
          input: {
            id: companion.id,
            name: companion.name,
            gender: companion.gender,
            birthday: companion.birthday,
            personalities: companion.personalities,
            story: companion.story,
            passionateTender: companion.passionateTender,
            dominantSubmissive: companion.dominantSubmissive,
            experimentalVanilla: companion.experimentalVanilla,
            payload: JSON.stringify(companion),
          },
        },
      })
      .catch(() => undefined);
  };

  const addCompanion = (companion: Companion) => {
    upsertCompanion(companion);
  };

  const persistCompanion = (companion: Companion) => {
    client
      .mutate({
        mutation: UPSERT_COMPANION,
        variables: {
          input: {
            id: companion.id,
            name: companion.name,
            gender: companion.gender,
            birthday: companion.birthday,
            personalities: companion.personalities,
            story: companion.story,
            passionateTender: companion.passionateTender,
            dominantSubmissive: companion.dominantSubmissive,
            experimentalVanilla: companion.experimentalVanilla,
            payload: JSON.stringify(companion),
          },
        },
      })
      .catch(() => undefined);
  };

  const updateCompanion = (id: string, patch: Partial<Companion>) => {
    setCompanions((current) => {
      const next = current.map((item) =>
        item.id === id ? { ...item, ...patch, id } : item
      );
      const updated = next.find((item) => item.id === id);
      if (updated) {
        persistCompanion(updated);
      }
      return next;
    });
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
