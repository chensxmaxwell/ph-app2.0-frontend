import Alarm from "@images/alarm.svg";
import Heart from "@images/heart.svg";
import MockProfile from "@images/mock_profile.svg";
import MockProfile1 from "@images/mock_profile1.svg";
import MockProfile2 from "@images/mock_profile2.svg";
import MockProfile3 from "@images/mock_profile3.svg";
import MockProfile4 from "@images/mock_profile4.svg";
import MockProfile5 from "@images/mock_profile5.svg";
import MockProfile6 from "@images/mock_profile6.svg";
import MockProfile7 from "@images/mock_profile7.svg";
import MockProfile8 from "@images/mock_profile8.svg";
import MockProfile9 from "@images/mock_profile9.svg";
import HeartFull from "@images/heartFull.svg";
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

export const useHome = () => {
  // TODO* replace this mock data with real data
  const companions: chatBotType[] = [
    {
      name: "Samantha",
      gender: "M",
      birthdate: "1995-01-01",
      photos: [],
      tags: ["funny", "smart", "adventurous"],
      language: "en",
      profilePicture: MockProfile,
    },
    {
      name: "Riley",
      gender: "M",
      birthdate: "1995-01-01",
      photos: [],
      tags: ["funny", "smart", "adventurous"],
      language: "en",
      profilePicture: MockProfile4,
    },
    {
      name: "Jordan",
      gender: "M",
      birthdate: "1995-01-01",
      photos: [],
      tags: ["funny", "smart", "adventurous"],
      language: "en",
      profilePicture: MockProfile2,
    },
    {
      name: "Alex",
      gender: "M",
      birthdate: "1995-01-01",
      photos: [],
      tags: ["funny", "smart", "adventurous"],
      language: "en",
      profilePicture: MockProfile5,
    },
    {
      name: "Casey",
      gender: "M",
      birthdate: "1995-01-01",
      photos: [],
      tags: ["funny", "smart", "adventurous"],
      language: "en",
      profilePicture: MockProfile9,
    },
    {
      name: "Quinn",
      gender: "M",
      birthdate: "1995-01-01",
      photos: [],
      tags: ["funny", "smart", "adventurous"],
      language: "en",
      profilePicture: MockProfile6,
    },
    {
      name: "Reese",
      gender: "M",
      birthdate: "1995-01-01",
      photos: [],
      tags: ["funny", "smart", "adventurous"],
      language: "en",
      profilePicture: MockProfile7,
    },
    {
      name: "Morgan",
      gender: "M",
      birthdate: "1995-01-01",
      photos: [],
      tags: ["funny", "smart", "adventurous"],
      language: "en",
      profilePicture: MockProfile8,
    },
  ];
  // TODO* replace this mock data with real data
  const events: HomeEvent[] = [
    {
      type: "Alarm",
      title: "Alarm",
      icon: Alarm,
      detail: "7:00 am \n Monday",
      forward: [
        SCREENS.PLAYGROUND_STACK,
        SCREENS.ALARM_STACK,
        SCREENS.SETALARM_INTRO,
      ],
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
    {
      type: "Feed",
      title: "Feed",
      icon: HeartFull,
      detail: "See what others are saying.",
      screen: SCREENS.FEED,
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
    companions,
    events,
    navigateToNestedScreen,
  };
};

type chatBotType = {
  name: string;
  gender: string;
  birthdate: string;
  height?: string;
  bodyType?: string;
  photos: string[];
  tags: string[];
  description?: string;
  personality?: string;
  profilePhoto?: string;
  examples?: exampleSchemaType[];
  language: string;
  profilePicture?: any;
};

type exampleSchemaType = {
  user: string;
  reply: string;
};

type NestedNavigationParams = {
  navigation: NavigationProp<any>;
  path: { screen: string; params?: object }[];
};
