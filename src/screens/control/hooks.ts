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

export const useControl = () => {
  const navigation = useNavigation<NavigationType>();

  const controls: ControlType[] = [
    {
      title: "Auto",
      Icon: Auto,
      onPress: () => navigation.navigate(SCREENS.AUTO),
    },
    {
      title: "Playground",
      Icon: PlayGround,
      onPress: () => navigation.navigate(SCREENS.PLAYGROUND_STACK),
    },
    {
      title: "Pattern",
      Icon: Pattern,
      onPress: () => navigation.navigate(SCREENS.PATTERN),
    },
    {
      title: "Manual",
      Icon: Manual,
      onPress: () => navigation.navigate(SCREENS.MANUAL),
    },
    {
      title: "Kink",
      Icon: Kink,
      onPress: () => navigation.navigate(SCREENS.KINK_HUB),
    },
    {
      title: "Sync",
      Icon: Sync,
      onPress: () => navigation.navigate(SCREENS.SYNC_STACK),
    },
  ];
  return {
    controls,
  };
};

export type ControlType = {
  title: string;
  Icon: React.FC<SvgProps>;
  onPress?: () => void;
};
