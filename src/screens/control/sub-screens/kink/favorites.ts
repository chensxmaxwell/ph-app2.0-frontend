import { useEffect, useState } from "react";

import {
  getCurrentUserId,
  subscribeSessionUser,
} from "../../../../backend/session";
import {
  loadKinkFavorites,
  saveKinkFavorites,
  toggleKinkFavorite,
} from "../../../../backend/store";

// Hearts shown before the user has ever toggled anything.
export const DEFAULT_KINK_FAVORITES: readonly string[] = ["Hardcore"];

export type KinkFavoritesState = {
  userId: string | null;
  ids: string[];
  hydrated: boolean;
};

type Listener = (state: KinkFavoritesState) => void;

const defaults = () => [...DEFAULT_KINK_FAVORITES];

const initialState = (): KinkFavoritesState => ({
  userId: null,
  ids: defaults(),
  hydrated: false,
});

// Module-level copy of the signed-in user's hearts. The hub screen is
// unmounted every time the user leaves Kink, so component state alone is lost;
// this cache lets a remount paint the persisted hearts on the first frame and
// keeps every mounted hub in sync. AsyncStorage is the source of truth across
// process death.
let state: KinkFavoritesState = initialState();
let loadingFor: string | null = null;
let loading: Promise<void> = Promise.resolve();
const listeners = new Set<Listener>();

const publish = (next: KinkFavoritesState) => {
  state = next;
  listeners.forEach((listener) => listener(state));
};

export const peekKinkFavorites = () => state;

export const resetKinkFavoritesCache = () => {
  state = initialState();
  loadingFor = null;
  loading = Promise.resolve();
};

export const hydrateKinkFavorites = (userId: string | null): Promise<void> => {
  if (!userId) {
    loadingFor = null;
    if (state.userId !== null || !state.hydrated) {
      publish({ userId: null, ids: defaults(), hydrated: true });
    }
    return Promise.resolve();
  }
  if (state.userId === userId && state.hydrated) {
    return Promise.resolve();
  }
  if (loadingFor === userId) {
    return loading;
  }
  loadingFor = userId;
  publish({ userId, ids: defaults(), hydrated: false });
  loading = loadKinkFavorites(userId, defaults())
    .catch(defaults)
    .then((ids) => {
      // A different account signed in while this read was in flight.
      if (loadingFor !== userId) {
        return;
      }
      loadingFor = null;
      publish({ userId, ids, hydrated: true });
    });
  return loading;
};

// Waits for hydration so a heart tapped while the stored list is still being
// read lands on top of the stored list instead of the defaults.
export const toggleKinkFavoriteForUser = (
  userId: string,
  id: string
): Promise<string[]> =>
  hydrateKinkFavorites(userId).then(() => {
    if (state.userId !== userId) {
      return state.ids;
    }
    const ids = toggleKinkFavorite(state.ids, id);
    publish({ ...state, ids });
    return saveKinkFavorites(userId, ids)
      .catch(() => undefined)
      .then(() => ids);
  });

export const useKinkFavorites = () => {
  const [favorites, setFavorites] = useState<KinkFavoritesState>(state);

  useEffect(() => {
    listeners.add(setFavorites);
    setFavorites(state);
    const unsubscribe = subscribeSessionUser((user) => {
      hydrateKinkFavorites(user?.id ?? null);
    });
    return () => {
      unsubscribe();
      listeners.delete(setFavorites);
    };
  }, []);

  const isFavorite = (id: string) => favorites.ids.includes(id);

  const toggleFavorite = (id: string) => {
    const userId = getCurrentUserId();
    if (!userId) {
      // Nobody signed in: keep the heart responsive but session-only.
      publish({ ...state, ids: toggleKinkFavorite(state.ids, id) });
      return;
    }
    toggleKinkFavoriteForUser(userId, id).catch(() => undefined);
  };

  return {
    favorites: favorites.ids,
    hydrated: favorites.hydrated,
    isFavorite,
    toggleFavorite,
  };
};
