import {
  CommonActions,
  NavigationProp,
  ParamListBase,
} from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { LoveLayer } from "./types";

const LOVE_SCREENS = new Set([
  String(SCREENS.LOVE_CHAT),
  String(SCREENS.LOVE_CALL),
  String(SCREENS.LOVE_SYNC),
]);

export const dismissLoveOverlays = (
  navigation: NavigationProp<ParamListBase>,
  then?: { name: string; params?: object }
) => {
  navigation.dispatch((state) => {
    const kept = state.routes.filter(
      (route) => !LOVE_SCREENS.has(String(route.name))
    );
    const routes = then
      ? [...kept, { name: then.name, params: then.params }]
      : kept;
    const next =
      routes.length > 0
        ? routes
        : [{ name: String(SCREENS.NAV_BAR) }];
    return CommonActions.reset({
      index: Math.max(0, next.length - 1),
      routes: next as never,
    });
  });
};

export const restoreLoveOverlays = (
  navigation: NavigationProp<ParamListBase>,
  layer: LoveLayer | null,
  companionId?: string
) => {
  const params = { companionId };
  navigation.navigate(SCREENS.LOVE_CHAT as never, params as never);
  if (layer === "call") {
    navigation.navigate(SCREENS.LOVE_CALL as never, params as never);
    return;
  }
  if (layer === "sync") {
    navigation.navigate(SCREENS.LOVE_SYNC as never, params as never);
  }
};
