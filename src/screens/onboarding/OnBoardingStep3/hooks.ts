import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";



export const useOnboarding3 = () => {
    const navigation = useNavigation<NavigationType>();

    
    const handleNavigateToSkip = () => navigation.reset({
        index: 0,
        routes: [{ name: SCREENS.MAIN }],
      });
    

    const handleNavigateToOnBoarding4 = () => {
        navigation.navigate(SCREENS.ONBOARDING_STEP4);
    };

    const handleNavigateToBack = () => {
        navigation.goBack()
    };

    return {
        handleNavigateToSkip,
        handleNavigateToOnBoarding4,
        handleNavigateToBack,
    };
  };