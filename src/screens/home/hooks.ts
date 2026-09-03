import Alarm from "@images/alarm.svg";
import Heart from "@images/heart.svg";
import { SCREENS } from "../../../src/common/constant";
import { NavigationProp } from "@react-navigation/native";

type HomeEvent = {
  type: string;
  title: string;
  icon: any;
  detail: string;
  forward: string[];
  screen?: string;
  params?: object;
};

// My Companions is not here: Home reads the Message friends list through
// ./companions.ts so the two screens cannot disagree about who exists.
export const useHome = () => {
  // TODO* replace this mock data with real data
  const events: HomeEvent[] = [
    {
      type: "Alarm",
      title: "Alarm",
      icon: Alarm,
      detail: "7:00 am \n Monday",
      forward: [SCREENS.PLAYGROUND_STACK, SCREENS.ALARM_STACK],
    },
    {
      type: "Vibration",
      title: "Hardcore",
      icon: Heart,
      detail: "Changes vibration patterns based on your selection.",
      screen: SCREENS.PERFORMANCE_PLAY,
      params: { title: "Hardcore" },
      forward: [],
    },
  ];

  const navigateToNestedScreen = ({
    navigation,
    path,
  }: NestedNavigationParams) => {
    if (path.length === 0) {
      console.error("Navigation path cannot be empty.");
      return;
    }

    const [current, ...rest] = path;

    if (rest.length === 0) {
      // 最后一层，直接导航到目标 screen
      navigation.navigate(current.screen, current.params);
    } else {
      // 构造嵌套导航路径
      navigation.navigate(current.screen, {
        screen: rest[0].screen, // 下一层的 screen
        params: {
          ...current.params,
          ...{
            screen: rest[0].screen,
            params:
              rest.length > 1
                ? { screen: rest[1].screen, params: {} }
                : rest[0].params,
          },
        },
      });
    }
  };

  return {
    events,
    navigateToNestedScreen,
  };
};

type NestedNavigationParams = {
  navigation: NavigationProp<any>;
  path: { screen: string; params?: object }[];
};
