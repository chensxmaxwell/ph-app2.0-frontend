import { NavigationProp, ParamListBase } from "@react-navigation/native";

export const closeGenerate = (
  navigation: NavigationProp<ParamListBase>
) => {
  const parent = navigation.getParent();
  if (parent) {
    parent.goBack();
    return;
  }
  navigation.goBack();
};
