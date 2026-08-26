import { NavigationType } from "../../../../../../../App";
import { useNavigation } from "@react-navigation/native";
import { GlobalContext } from "../../../../../../store";
import { useContext } from "react";

export const usePattern = () => {
  const { globalState, setGlobalState } = useContext(GlobalContext);
  const navigation = useNavigation<NavigationType>();

  const handleStartPatternPress = () => {
    navigation.goBack();
  };

  const handleReturnPress = () => {
    navigation.goBack();
  };

  return {
    handleStartPatternPress,
    handleReturnPress,
  };
};
