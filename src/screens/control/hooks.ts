import { SvgProps } from "react-native-svg";

import Auto from "@images/icons/auto-icon.svg";
import PlayGround from "@images/icons/play-ground-icon.svg";
import Pattern from "@images/icons/pattern-icon.svg";
import Manual from "@images/icons/manual-icon.svg";
import Kink from "@images/icons/kink-icon.svg";
import Sync from "@images/icons/sync-icon.svg";
import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../App";
import { SCREENS } from "@common/constant";
import { useHomeScreen } from "../../hooks/HomeScreenContext";

type HomeScreenApi = {
  currentMode: string;
  setCurrentMode: (mode: string) => void;
  autoIntensity: number;
  setAutoIntensity: (value: number) => void;
};

export const useControl = () => {
  const navigation = useNavigation<NavigationType>();
  const { currentMode, setCurrentMode, autoIntensity, setAutoIntensity } =
    useHomeScreen() as HomeScreenApi;
  const autoOn = currentMode === "auto";

  const toggleAuto = () => {
    setCurrentMode(autoOn ? "" : "auto");
  };

  const controls: ControlType[] = [
    {
      id: "auto",
      title: "Auto",
      Icon: Auto,
      active: autoOn,
      onPress: toggleAuto,
    },
    {
      id: "playground",
      title: "Playground",
      Icon: PlayGround,
      onPress: () => navigation.navigate(SCREENS.PLAYGROUND_STACK),
    },
    {
      id: "pattern",
      title: "Pattern",
      Icon: Pattern,
      onPress: () => navigation.navigate(SCREENS.PATTERN),
    },
    {
      id: "manual",
      title: "Manual",
      Icon: Manual,
      onPress: () => navigation.navigate(SCREENS.MANUAL),
    },
    {
      id: "kink",
      title: "Kink",
      Icon: Kink,
      onPress: () => navigation.navigate(SCREENS.KINK_HUB),
    },
    {
      id: "sync",
      title: "Sync",
      Icon: Sync,
      onPress: () => navigation.navigate(SCREENS.SYNC_STACK),
    },
  ];
  return {
    controls,
    autoOn,
    autoIntensity,
    setAutoIntensity,
  };
};

export type ControlType = {
  id: string;
  title: string;
  Icon: React.FC<SvgProps>;
  onPress?: () => void;
  active?: boolean;
};
