import { useHomeScreen } from "../../../hooks/HomeScreenContext";
import { useDevice } from "../../../store/device";
import { SCREENS } from "../../constant";
import { useNavigation } from "@react-navigation/native";

export const useConnectionPill = () => {
  const { isConnected } = useHomeScreen();
  const { battery, connecting } = useDevice();
  const navigation = useNavigation();

  const toggleDevice = () => {
    navigation.navigate(SCREENS.CONNECT_DEVICE);
  };

  return {
    connectStatus: isConnected,
    connecting,
    battery,
    toggleDevice,
  };
};
