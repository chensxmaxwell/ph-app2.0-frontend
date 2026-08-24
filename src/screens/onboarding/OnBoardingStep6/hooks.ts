import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";



export const useOnboarding6 = () => {
    const navigation = useNavigation<NavigationType>();

    
    const handleNavigateToBack = () => navigation.goBack();
    

    const handleNavigateToSkip = () => navigation.reset({
        index: 0,
        routes: [{ name: SCREENS.MAIN }],
      });

    const handleNavigateToOnBoarding7 = () => {
        navigation.navigate(SCREENS.ONBOARDING_STEP7);
    };

    return {
        handleNavigateToBack,
        handleNavigateToOnBoarding7,
        handleNavigateToSkip
    };
  };