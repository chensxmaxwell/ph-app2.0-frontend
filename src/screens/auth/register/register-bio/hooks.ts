import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../../App";
import { SCREENS } from "@common/constant";
import { resetRoot } from "../../../../common/root-nav";

export const useRegisterBio = () => {
    const navigation = useNavigation<NavigationType>();

    const handleNavigateToSkipBio = () => {
        navigation.navigate(SCREENS.REGISTER_SKIP_BIO);
    };

    const handleNavigateToOnBoarding = () =>
      resetRoot(navigation, SCREENS.ONBOARDING);

    const handleNavigateBack = () => {
        navigation.goBack();
    };
    return {
        handleNavigateToSkipBio,
        handleNavigateToOnBoarding,
        handleNavigateBack,
    };
};
