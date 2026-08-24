import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";



export const useOnboarding4 = () => {
    const navigation = useNavigation<NavigationType>();

    
    const handleNavigateToBack = () => navigation.goBack();
    
    const handleNavigateToSkip = () => navigation.reset({
        index: 0,
        routes: [{ name: SCREENS.MAIN }],
      });

    const handleNavigateToOnBoarding5 = () => {
        navigation.navigate(SCREENS.ONBOARDING_STEP5);
        console.log('ccc');
    };

    const handleNavigateToConnectDevice = () => {
        console.log('aaa')
        navigation.navigate(SCREENS.CONNECT_DEVICE);
    };

    return {
        handleNavigateToBack,
        handleNavigateToOnBoarding5,
        handleNavigateToConnectDevice,
        handleNavigateToSkip
    };
  };