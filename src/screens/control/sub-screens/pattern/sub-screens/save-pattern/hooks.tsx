import { NavigationType } from "../../../../../../../App";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { GlobalContext } from "../../../../../../store";
import { useContext } from "react";
import { getCurrentUserId } from "../../../../../../backend/session";
import { upsertSavedPattern } from "../../../../../../backend/store";

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

        const last = updatedTmpPattern[updatedTmpPattern.length - 1] as any;
        const userId = getCurrentUserId();
        if (userId && last) {
          upsertSavedPattern(userId, {
            id: last.id || `pattern-${Date.now()}`,
            title: name,
            pattern: last.pattern || [],
          }).catch(() => undefined);
        }
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
