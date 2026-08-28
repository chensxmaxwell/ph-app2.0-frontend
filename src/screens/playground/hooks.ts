import { SCREENS } from "@common/constant";
import Alarm from "@images/playground/alarm.svg";
import DeepDiscovery from "@images/playground/deep-discovery.svg";
import MotionSensor from "@images/playground/motion-sensor.svg";
import PleasureCanvas from "@images/playground/pleasure-canvas.svg";
import QuickBliss from "@images/playground/quick-bliss.svg";
import Sound from "@images/playground/sound.svg";
import { useNavigation } from "@react-navigation/native";
import { FC } from "react";
import { SvgProps } from "react-native-svg";

export const usePlayground = () => {
  const navigation = useNavigation();
  const playgroundOptions: PlaygroundOption[] = [
    {
      id: 1,
      name: "Quick bliss",
      detail: "Achieve ultimate pleasure faster.",
      icon: QuickBliss,
      time: "15 mins",
      onPress: () => navigation.navigate(SCREENS.BLISS_STACK),
    },
    {
      id: 2,
      name: "Deep discovery",
      detail: "Slowly build your way to pleasure.",
      icon: DeepDiscovery,
      time: "15 mins - 60 mins",
      onPress: () => navigation.navigate(SCREENS.DEEP_DISCOVERY_STACK),
    },
    {
      id: 3,
      name: "Pleasure canvas",
      detail: "Take control with your touch.",
      icon: PleasureCanvas,
      onPress: () => navigation.navigate(SCREENS.CANVAS),
    },
    {
      id: 4,
      name: "Sound",
      detail: "Feel the rhythm, set the vibe.",
      icon: Sound,
      onPress: () => navigation.navigate(SCREENS.SOUND),
    },
    {
      id: 5,
      name: "Motion sensor",
      detail: "Shake to vibe your way.",
      icon: MotionSensor,
      onPress: () => navigation.navigate(SCREENS.MOTION_STACK),
    },
    {
      id: 6,
      name: "Alarm",
      detail: "Wake up to a scheduled vibe.",
      icon: Alarm,
      onPress: () => navigation.navigate(SCREENS.ALARM_STACK),
    },
  ];

  return {
    navigation,
    playgroundOptions,
  };
};

interface PlaygroundOption {
  id: number;
  icon: FC<SvgProps>;
  name: string;
  detail: string;
  time?: string;
  onPress: () => void;
}
