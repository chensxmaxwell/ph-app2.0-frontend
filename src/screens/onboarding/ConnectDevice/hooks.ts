import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";

export const useConnectDevice = () => {
    const navigation = useNavigation<NavigationType>();
    const route =
        useRoute<RouteProp<{ params: { fromOnboarding?: boolean } }, "params">>();
    const handleNavigateToBack = () => navigation.goBack();
    const fromOnboarding = !!route.params?.fromOnboarding;

    const handleContinue = () => {
        if (fromOnboarding) {
            navigation.navigate(SCREENS.USER_FEEDBACK);
            return;
        }
        navigation.goBack();
    };

    return {
        handleNavigateToBack,
        handleContinue,
        fromOnboarding,
    };
};