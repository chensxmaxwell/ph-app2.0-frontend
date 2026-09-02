import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { SCREENS } from "@common/constant";

type ConnectDeviceNav = {
    getState?: () => { index?: number } | undefined;
    canGoBack?: () => boolean;
    goBack: () => void;
    navigate: (name: never) => void;
};

export const leaveConnectDevice = (
    navigation: ConnectDeviceNav,
    fallback: never
) => {
    const index = navigation.getState?.()?.index;
    if (typeof index === "number" && index > 0) {
        navigation.goBack();
        return;
    }
    if (index === undefined && navigation.canGoBack?.()) {
        navigation.goBack();
        return;
    }
    navigation.navigate(fallback);
};

export const useConnectDevice = () => {
    const navigation = useNavigation<NavigationType>();
    const route =
        useRoute<RouteProp<{ params: { fromOnboarding?: boolean } }, "params">>();
    const fromOnboarding = !!route.params?.fromOnboarding;
    const handleNavigateToBack = () =>
        leaveConnectDevice(
            navigation,
            fromOnboarding ? SCREENS.ONBOARDING_STEP5 : SCREENS.NAV_BAR
        );

    const handleContinue = () => {
        if (fromOnboarding) {
            navigation.navigate(SCREENS.USER_FEEDBACK);
            return;
        }
        leaveConnectDevice(navigation, SCREENS.NAV_BAR);
    };

    return {
        handleNavigateToBack,
        handleContinue,
        fromOnboarding,
    };
};