import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../../App";
import { SCREENS } from "@common/constant";



export const useRegisterBio = () => {
    const navigation = useNavigation<NavigationType>();

    
    const handleNavigateToSkipBio = () => {
        navigation.navigate(SCREENS.REGISTER_SKIP_BIO);
    };

    const handleNavigateToOnBoarding = () => navigation.reset({
        index: 0,
        routes: [{ name: SCREENS.ONBOARDING }],
      });

    const handleNavigateBack = () => {
        navigation.goBack();
    };
    return {
        handleNavigateToSkipBio,
        handleNavigateToOnBoarding,
        handleNavigateBack,
    };
};