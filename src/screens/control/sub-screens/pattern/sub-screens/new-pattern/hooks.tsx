import { NavigationType } from "../../../../../../../App";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { GlobalContext } from "../../../../../../store";
import { useContext } from "react";

export const usePattern = () => {
  const { globalState, setGlobalState } = useContext(GlobalContext);
  const navigation = useNavigation<NavigationType>();

  const handleStartPatternPress = () => {};

  const handleReturnPress = () => {};

  return {
    handleStartPatternPress,
    handleReturnPress,
  };
};
