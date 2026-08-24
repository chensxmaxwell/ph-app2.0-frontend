import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";



export const useOnboarding7 = () => {
    const navigation = useNavigation<NavigationType>();

    
    const handleNavigateToBack = () => navigation.goBack();
    

    const handleNavigateToSkip = () => navigation.reset({
        index: 0,
        routes: [{ name: SCREENS.MAIN }],
      });

    const handleNavigateToMainPage = () =>
      navigation.navigate(SCREENS.PAIR_BAND_APP);

    return {
        handleNavigateToBack,
        handleNavigateToMainPage,
        handleNavigateToSkip
    };
  };