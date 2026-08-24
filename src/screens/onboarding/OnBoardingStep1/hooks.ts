import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";



export const useOnboarding1 = () => {
    const navigation = useNavigation<NavigationType>();

    
    const handleNavigateToSkip = () => navigation.reset({
        index: 0,
        routes: [{ name: SCREENS.MAIN }],
      });
    

    const handleNavigateToOnBoarding2 = () => {
        navigation.navigate(SCREENS.ONBOARDING_STEP2);
    };

    return {
        handleNavigateToSkip,
        handleNavigateToOnBoarding2,
    };
  };