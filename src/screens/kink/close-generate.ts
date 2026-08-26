import { NavigationProp, ParamListBase } from "@react-navigation/native";
import { SCREENS } from "@common/constant";

export const closeGenerate = (
  navigation: NavigationProp<ParamListBase>
) => {
  const parent = navigation.getParent();
  if (parent) {
    parent.goBack();
    return;
  }
  navigation.navigate(SCREENS.KINK_HUB);
};
