import { NavigationProp, ParamListBase } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { dismissLoveOverlays, getHomeStackNavigation } from "../love/overlay";
import { AvatarStackParams } from "./types";

export const openAvatarWizard = (
  navigation: NavigationProp<ParamListBase>,
  params: AvatarStackParams,
  fromLove = false
) => {
  const nav = getHomeStackNavigation() ?? navigation;
  if (fromLove) {
    dismissLoveOverlays(nav, {
      name: String(SCREENS.AVATAR_STACK),
      params,
    });
    return;
  }
  nav.navigate(SCREENS.AVATAR_STACK as never, params as never);
};
