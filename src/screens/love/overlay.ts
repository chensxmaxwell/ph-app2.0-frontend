import {
  CommonActions,
  NavigationProp,
  ParamListBase,
} from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { LoveLayer } from "./types";
import {
  LOVE_OVERLAY_SCREENS,
  stackForLoveLayer,
  stackForRestoredLoveLayer,
} from "./stack";
import type { LoveLayerParams, LoveStackSurface } from "./stack";

let homeStackNavigation: NavigationProp<ParamListBase> | null = null;

export const bindHomeStackNavigation = (
  navigation: NavigationProp<ParamListBase>
) => {
  homeStackNavigation = navigation;
};

export const getHomeStackNavigation = () => homeStackNavigation;

export const applyLoveLayer = (
  navigation: NavigationProp<ParamListBase>,
  {
    layer,
    params,
    surface,
  }: {
    layer: LoveLayer | null;
    params?: LoveLayerParams;
    surface: LoveStackSurface;
  }
) => {
  navigation.dispatch((state) => {
    const routes = stackForLoveLayer({
      routes: state.routes,
      layer,
      params,
      surface,
    });
    return CommonActions.reset({
      index: Math.max(0, routes.length - 1),
      routes: routes as never,
    });
  });
};

export const dismissLoveOverlays = (
  navigation: NavigationProp<ParamListBase>,
  then?: { name: string; params?: object }
) => {
  navigation.dispatch((state) => {
    const kept = state.routes.filter(
      (route) => !LOVE_OVERLAY_SCREENS.has(String(route.name))
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
  surface: LoveStackSurface,
  companionId?: string,
  name?: string
) => {
  navigation.dispatch((state) => {
    const routes = stackForRestoredLoveLayer({
      routes: state.routes,
      layer,
      params: { companionId, name },
      surface,
    });
    return CommonActions.reset({
      index: Math.max(0, routes.length - 1),
      routes: routes as never,
    });
  });
};
