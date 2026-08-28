import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";
import { resetToMain } from "../../../common/root-nav";

export const useOnboarding4 = () => {
    const navigation = useNavigation<NavigationType>();
    const handleNavigateToBack = () => navigation.goBack();
    const handleNavigateToSkip = () => resetToMain(navigation);
    const handleNavigateToOnBoarding5 = () => {
        navigation.navigate(SCREENS.ONBOARDING_STEP5);
    };
    const handleNavigateToConnectDevice = () => {
        navigation.navigate(SCREENS.CONNECT_DEVICE);
    };
    return {
        handleNavigateToBack,
        handleNavigateToOnBoarding5,
        handleNavigateToConnectDevice,
        handleNavigateToSkip
    };
  };
