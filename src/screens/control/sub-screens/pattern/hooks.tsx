import React, { useContext, useState } from "react";
import { Tab } from "../sub-components/tab-bar";
import Pattern1 from "@images/pattern1.svg";
import Pattern2 from "@images/pattern2.svg";
import Pattern3 from "@images/pattern3.svg";
import Pattern4 from "@images/pattern4.svg";
import Pattern5 from "@images/pattern5.svg";
import Pattern6 from "@images/pattern6.svg";
import Untitled from "@images/untitled.svg";
import Plus from "@images/icons/plus.svg";
import { View } from "react-native";
import { colors } from "@common/styles/colors";
import { CardType } from "../sub-components/cards-list";
import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../../App";
import { SCREENS } from "@common/constant";
import { GlobalContext } from "../../../../store";

const renderUntitle: React.FC = () => {
  return (
    <View
      style={{
        backgroundColor: colors.grayLightest,
        width: 75.5,
        height: 75.5,
        borderRadius: 75.5,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Untitled />
    </View>
  );
};

export const usePattern = () => {
  const navigation = useNavigation<NavigationType>();
  const [selectedTab, setSelectedTab] = useState("patterns");
  const handleTabSelect = (value: string) => {
    setSelectedTab(value);
  };
  const { globalState } = useContext(GlobalContext);
  const [tabs, _] = useState<Tab[]>([
    {
      title: "Patterns",
      value: "patterns",
      onPress: () => handleTabSelect("patterns"),
    },
    {
      title: "Saved",
      value: "saved",
      onPress: () => handleTabSelect("saved"),
    },
    {
      title: "Generated",
      value: "generated",
      onPress: () => handleTabSelect("generated"),
    },
    {
      title: "Recent",
      value: "recent",
      onPress: () => handleTabSelect("recent"),
    },
  ]);

  const handleLightbulbPress = () => {
    console.log("Lightbulb pressed");
  };
  const handlePatternPress = ({
    pattern,
    title,
  }: {
    pattern?: number[];
    title: string;
  }) => navigation.navigate(SCREENS.DISPLAY_PATTERN, { pattern, title });
  const handleCreatePatternPress = () =>
    navigation.navigate(SCREENS.CREATE_PATTERN);

  // *TODO: Get patterns from API
  const patterns: CardType[] = [
    {
      Icon: Plus,
      title: "Create",
      description: "Create your own fun",
      onPress: () => handleCreatePatternPress(),
      hideFavorite: true,
    },
    {
      Icon: renderUntitle,
      title: "Untitled",
      onPress: () =>
        handlePatternPress({
          title: "Untitled",
          pattern: [20, 40, 60, 80, 100, 80, 60, 40, 20, 10],
        }),
      favorite: true,
    },
    {
      Icon: Pattern1,
      onPress: () =>
        handlePatternPress({
          title: "Pattern 01",
          pattern: [
            0, 99, 34, 48, 50, 50, 4, 14, 23, 35, 70, 100, 0, 100, 34, 48, 114,
            50, 4, 55, 23, 44, 70, 22, 0, 5, 20, 30, 40, 10,
          ],
        }),
    },
    {
      Icon: Pattern2,
      onPress: () =>
        handlePatternPress({
          title: "Pattern 01",
          pattern: [
            62, 32, 40, 41, 28, 56, 32, 89, 55, 95, 80, 9, 81, 59, 81, 35, 57,
            8, 48, 57, 77, 28, 75, 38, 73, 59, 15, 62, 88, 78,
          ],
        }),
    },
    {
      Icon: Pattern3,
      onPress: () =>
        handlePatternPress({
          title: "Pattern 01",
          pattern: [
            64, 32, 0, 28, 23, 32, 2, 13, 70, 86, 82, 97, 33, 45, 73, 64, 11,
            46, 18, 28, 58, 71, 16, 88, 9, 14, 41, 3, 10, 20,
          ],
        }),
    },
    {
      Icon: Pattern4,
      onPress: () =>
        handlePatternPress({
          title: "Pattern 01",
          pattern: [
            23, 23, 7, 75, 46, 78, 22, 30, 24, 32, 86, 58, 16, 84, 12, 79, 96,
            62, 11, 54, 31, 66, 48, 77, 56, 61, 78, 25, 23, 18,
          ],
        }),
    },
    {
      Icon: Pattern5,
      onPress: () =>
        handlePatternPress({
          title: "Pattern 01",
          pattern: [
            30, 34, 89, 34, 51, 14, 8, 63, 62, 32, 98, 7, 33, 85, 61, 91, 34,
            39, 70, 19, 14, 38, 96, 67, 87, 58, 10, 58, 80, 82,
          ],
        }),
    },
    {
      Icon: Pattern6,
      onPress: () =>
        handlePatternPress({
          title: "Pattern 01",
          pattern: [
            20, 30, 30, 62, 67, 81, 66, 75, 25, 11, 47, 60, 8, 4, 47, 60, 28,
            35, 2, 58, 57, 64, 67, 83, 38, 69, 52, 69, 67, 44,
          ],
        }),
    },
    ...globalState.tmp_pattern,
  ];

  return {
    tabs,
    selectedTab,
    handleLightbulbPress,
    patterns,
    handlePatternPress,
  };
};
