import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";
import { resetToMain } from "../../../common/root-nav";

export const useOnboarding7 = () => {
    const navigation = useNavigation<NavigationType>();
    const handleNavigateToBack = () => navigation.goBack();
    const handleNavigateToSkip = () => resetToMain(navigation);
    const handleNavigateToMainPage = () =>
      navigation.navigate(SCREENS.PAIR_BAND_APP);
    return {
        handleNavigateToBack,
        handleNavigateToMainPage,
        handleNavigateToSkip
    };
  };
