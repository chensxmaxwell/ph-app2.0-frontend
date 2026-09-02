import { SCREENS } from "@common/constant";
import { LoveLayer } from "./types";

export type LoveStackRoute = {
  name: string;
  params?: object;
};

export type LoveStackSurface = "love" | "message";

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
  let kept = routes.filter(
    (route) => !LOVE_OVERLAY_SCREENS.has(nameOf(route.name))
  );
  if (surface === "love") {
    kept = kept.filter((route) => !isMatchingChatThread(route, companionId));
  }
  const next = ensureRoot(kept);
  if (surface === "message") {
    if (layer === "call") {
      return [...next, { name: nameOf(SCREENS.LOVE_CALL), params }];
    }
    if (layer === "sync") {
      return [...next, { name: nameOf(SCREENS.LOVE_SYNC), params }];
    }
    return next;
  }
  const withChat = [
    ...next,
    { name: nameOf(SCREENS.LOVE_CHAT), params },
  ];
  if (layer === "call") {
    return [...withChat, { name: nameOf(SCREENS.LOVE_CALL), params }];
  }
  if (layer === "sync") {
    return [...withChat, { name: nameOf(SCREENS.LOVE_SYNC), params }];
  }
  return withChat;
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
  if (surface === "love") {
    return stackForLoveLayer({ routes, layer, params, surface });
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
