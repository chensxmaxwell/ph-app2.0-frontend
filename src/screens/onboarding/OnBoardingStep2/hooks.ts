import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";
import { resetToMain } from "../../../common/root-nav";

export const useOnboarding2 = () => {
    const navigation = useNavigation<NavigationType>();
    const handleNavigateToSkip = () => resetToMain(navigation);
    const handleNavigateToOnBoarding3 = () => {
        navigation.navigate(SCREENS.ONBOARDING_STEP3);
    };
    const handleNavigateToBack = () => {
        navigation.goBack()
    };
    return {
        handleNavigateToSkip,
        handleNavigateToOnBoarding3,
        handleNavigateToBack,
    };
  };
