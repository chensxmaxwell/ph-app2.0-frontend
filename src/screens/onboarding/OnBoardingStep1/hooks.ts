import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";
import { resetToMain } from "../../../common/root-nav";

export const useOnboarding1 = () => {
    const navigation = useNavigation<NavigationType>();
    const handleNavigateToSkip = () => resetToMain(navigation);
    const handleNavigateToOnBoarding2 = () => {
        navigation.navigate(SCREENS.ONBOARDING_STEP2);
    };
    return {
        handleNavigateToSkip,
        handleNavigateToOnBoarding2,
    };
  };
