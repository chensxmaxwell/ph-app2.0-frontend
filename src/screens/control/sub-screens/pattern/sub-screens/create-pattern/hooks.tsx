import { useContext, useEffect, useRef, useState } from "react";
import { PatternType } from "../vibration-graph";
import { HandleDraggingProps } from "../../../../../../common/components/draggable-circle";
import { LayoutChangeEvent } from "react-native";
import { GlobalContext } from "../../../../../../store";
import Pattern1 from "@images/pattern1.svg";
import { usePattern } from "../../hooks";
import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../../../../App";
import { SCREENS } from "@common/constant";

export const useCreatePattern = ({ pattern }: UsePlayPatternProps) => {
  const [start, setStart] = useState(false);
  const [displayPattern, setDisplayPattern] = useState<PatternType>(pattern);
  const recordPattern = useRef<PatternType>([]);
  const currentPostion = useRef<number>(0);
  const [countup, setCountup] = useState(0);
  const startTime = useRef<Date | null>(null);
  const { setGlobalState } = useContext(GlobalContext);
  const { handlePatternPress } = usePattern();
  const navigation = useNavigation<NavigationType>();
  useEffect(() => {
    if (start) {
      startTime.current = new Date();

      const intervalId = setInterval(() => {
        setDisplayPattern((prevPattern) => {
          const newPattern = [...prevPattern, currentPostion.current];
          if (newPattern.length > 30) {
            newPattern.shift();
          }
          return newPattern;
        });
        recordPattern.current = [
          ...recordPattern.current,
          currentPostion.current,
        ];
        if (startTime.current) {
          const now = new Date();
          const diff = Math.floor(
            (now.getTime() - startTime.current.getTime()) / 1000
          );
          setCountup(diff);
        }
      }, 500);

      const stopTimeoutId = setTimeout(() => {
        setStart(false);
        setGlobalState((prevState) => ({
          ...prevState,
          tmp_pattern: [
            ...prevState.tmp_pattern,
            {
              Icon: Pattern1,
              title: "Custom Pattern",
              pattern: recordPattern.current,
              onPress: () =>
                handlePatternPress({
                  title: "Custom Pattern",
                  pattern: recordPattern.current,
                }),
            },
          ],
        }));
        clearInterval(intervalId);
       
      }, 30000);

      return () => {
        
        clearInterval(intervalId);
        clearTimeout(stopTimeoutId);
      };
    }
  }, [start]);

  const handleDragging = ({ proportionalY }: HandleDraggingProps) => {
    currentPostion.current = proportionalY;
  };

  const handleStart = () => {
    setStart(true);
  };

  const handleSavePress = () => {
    navigation.navigate(SCREENS.SAVE_PATTERN)
  }

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
  };

  return {
    start,
    displayPattern,
    handleDragging,
    handleStart,
    dimensions,
    countup,
    onLayout,
    handleSavePress
  };
};

type UsePlayPatternProps = {
  pattern: PatternType;
};
