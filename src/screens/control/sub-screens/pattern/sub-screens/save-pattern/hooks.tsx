import { NavigationType } from "../../../../../../../App";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { GlobalContext } from "../../../../../../store";
import { useContext } from "react";

export const usePattern = () => {
  const { setGlobalState } = useContext(GlobalContext);
  const navigation = useNavigation<NavigationType>();
  
  const handleSavePatternPress = (name: string) => {
    console.log("Saving pattern with title:", name);

    setGlobalState((prevState) => {
  
      if (prevState.tmp_pattern.length > 0) {
        const updatedTmpPattern = [...prevState.tmp_pattern];
        updatedTmpPattern[updatedTmpPattern.length - 1] = {
          ...updatedTmpPattern[updatedTmpPattern.length - 1],
          title: name,
        };

        return {
          ...prevState,
          tmp_pattern: updatedTmpPattern,
        };
      }

      return prevState;
    });

    navigation.dispatch(
      CommonActions.reset({
        index: 2,
        routes: [
          { name: SCREENS.NAV_BAR },
          { name: SCREENS.PATTERN },
          { name: SCREENS.NEW_PATTERN },
        ],
      })
    );
  };

  const handleReturnPress = () => {
    navigation.goBack();
  };

  return {
    handleSavePatternPress,
    handleReturnPress,
  };
};
