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

// The one "create a character" entry. Home `+` and Message `+` → Create new
// both go through here so they cannot drift onto different forms again.
export const CREATE_COMPANION_PARAMS: AvatarStackParams = { mode: "create" };

export const openCreateCompanion = (
  navigation: NavigationProp<ParamListBase>
) => {
  openAvatarWizard(navigation, CREATE_COMPANION_PARAMS);
};

// Edit persona for an existing person, whether it already has a 3D companion
// record or is still a chat-only bot (seeded Kevin / Amanda, or a bot whose
// avatar was never crafted). Same Identity form, same rules.
export const openEditPersona = (
  navigation: NavigationProp<ParamListBase>,
  companionId: string,
  fromLove = false
) => {
  openAvatarWizard(navigation, { mode: "editPersona", companionId }, fromLove);
};
