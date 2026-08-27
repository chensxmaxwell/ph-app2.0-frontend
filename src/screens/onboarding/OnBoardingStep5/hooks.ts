import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";
import { resetToMain } from "../../../common/root-nav";

export const useOnboarding5 = () => {
    const navigation = useNavigation<NavigationType>();
    const handleNavigateToBack = () => navigation.goBack();
    const handleNavigateToSkip = () => resetToMain(navigation);
    const handleNavigateToOnBoarding6 = () => {
        navigation.navigate(SCREENS.ONBOARDING_STEP6);
    };
    const handleNavigateToConnectDevice = () => {
        navigation.navigate(SCREENS.CONNECT_DEVICE);
    };
    return {
        handleNavigateToBack,
        handleNavigateToOnBoarding6,
        handleNavigateToConnectDevice,
        handleNavigateToSkip
    };
  };
