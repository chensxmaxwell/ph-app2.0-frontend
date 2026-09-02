import { SCREENS } from "@common/constant";
import { LoveLayer } from "./types";

export type LoveStackRoute = {
  name: string;
  params?: object;
};

/**
 * Where a Love session was entered from, i.e. what sits under the Call/Sync
 * overlay and where hang-up returns to:
 * - `love`: the dark Love chat. Overlays stack on `LOVE_CHAT`.
 * - `message`: a Message `CHAT_THREAD`. Overlays stack on that thread.
 * - `control`: the Control hub Sync card (`SYNC_STACK` picker). Nothing
 *   Love-related sits underneath, so overlays stack straight on the hub.
 */
export type LoveStackSurface = "love" | "message" | "control";

export type LoveLayerParams = {
  companionId?: string;
  name?: string;
  fromCreation?: boolean;
  syncing?: boolean;
};

const nameOf = (value: unknown) => String(value);

export const LOVE_OVERLAY_SCREENS = new Set([
  nameOf(SCREENS.LOVE_CHAT),
  nameOf(SCREENS.LOVE_CALL),
  nameOf(SCREENS.LOVE_SYNC),
]);

const threadIdOf = (route: LoveStackRoute) =>
  (route.params as { threadId?: string } | undefined)?.threadId;

const isMatchingChatThread = (
  route: LoveStackRoute,
  companionId?: string
) => {
  if (nameOf(route.name) !== nameOf(SCREENS.CHAT_THREAD)) {
    return false;
  }
  if (!companionId) {
    return false;
  }
  return threadIdOf(route) === companionId;
};

const ensureRoot = (routes: LoveStackRoute[]): LoveStackRoute[] =>
  routes.length > 0 ? routes : [{ name: nameOf(SCREENS.NAV_BAR) }];

const overlayForLayer = (
  layer: LoveLayer | null,
  params?: LoveLayerParams
): LoveStackRoute | null => {
  switch (layer) {
    case "call":
      return { name: nameOf(SCREENS.LOVE_CALL), params };
    case "sync":
      return { name: nameOf(SCREENS.LOVE_SYNC), params };
    case "chat":
    case null:
      return null;
    default: {
      const exhaustive: never = layer;
      return exhaustive;
    }
  }
};

export const stackForLoveLayer = ({
  routes,
  layer,
  params,
  surface,
}: {
  routes: LoveStackRoute[];
  layer: LoveLayer | null;
  params?: LoveLayerParams;
  surface: LoveStackSurface;
}): LoveStackRoute[] => {
  const companionId = params?.companionId;
  const kept = routes.filter(
    (route) => !LOVE_OVERLAY_SCREENS.has(nameOf(route.name))
  );
  const overlay = overlayForLayer(layer, params);
  switch (surface) {
    case "love": {
      const withChat = [
        ...ensureRoot(
          kept.filter((route) => !isMatchingChatThread(route, companionId))
        ),
        { name: nameOf(SCREENS.LOVE_CHAT), params },
      ];
      return overlay ? [...withChat, overlay] : withChat;
    }
    case "message":
    case "control": {
      // The chat lives on the origin surface itself, so a `chat` layer needs
      // no overlay and Call/Sync go straight on top of what is already there.
      const base = ensureRoot(kept);
      return overlay ? [...base, overlay] : base;
    }
    default: {
      const exhaustive: never = surface;
      return exhaustive;
    }
  }
};

export const stackForRestoredLoveLayer = ({
  routes,
  layer,
  params,
  surface,
}: {
  routes: LoveStackRoute[];
  layer: LoveLayer | null;
  params?: LoveLayerParams;
  surface: LoveStackSurface;
}): LoveStackRoute[] => {
  switch (surface) {
    case "love":
    case "control":
      // Nothing to rebuild underneath: Love chat is part of the layer stack,
      // and the Control hub is whatever the pill was tapped on.
      return stackForLoveLayer({ routes, layer, params, surface });
    case "message":
      break;
    default: {
      const exhaustive: never = surface;
      return exhaustive;
    }
  }

  const companionId = params?.companionId;
  const kept = routes.filter(
    (route) => !LOVE_OVERLAY_SCREENS.has(nameOf(route.name))
  );
  const matchingThreadIndex = kept.findIndex((route) =>
    isMatchingChatThread(route, companionId)
  );
  const throughThread =
    matchingThreadIndex >= 0
      ? kept.slice(0, matchingThreadIndex + 1)
      : companionId
      ? [
          ...ensureRoot(kept),
          {
            name: nameOf(SCREENS.CHAT_THREAD),
            params: { threadId: companionId },
          },
        ]
      : ensureRoot(kept);

  return stackForLoveLayer({
    routes: throughThread,
    layer,
    params,
    surface,
  });
};
