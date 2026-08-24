import { SvgProps } from 'react-native-svg';
import { useState, useEffect } from 'react';
import { useHomeScreen } from '../../../../hooks/HomeScreenContext';

export const useManual = () => {
  const [currentValue, setCurrentValue] = useState(40);
  const [playing, setPlaying] = useState(false);
  const { setCurrentMode, setMotorInput } = useHomeScreen();

  const handleLevelChange = (value: number) => {
    setCurrentValue(value);
  };

  const handlePlayButtonPress = () => {
    setPlaying((current) => !current);
  };

  const handleLightbulbPress = () => undefined;

  useEffect(() => {
    return () => {
      setCurrentMode('');
      setMotorInput([]);
    };
  }, []);

  useEffect(() => {
    if (!playing) {
      setCurrentMode('');
      setMotorInput([]);
      return;
    }
    const level = Math.max(5, Math.min(100, currentValue));
    setCurrentMode('manual');
    setMotorInput([1, level, level, level]);
  }, [currentValue, playing]);

  return {
    currentValue,
    playing,
    handleLevelChange,
    handlePlayButtonPress,
    handleLightbulbPress
  };
};


export type controlType = {
  type: 'auto' | 'play-ground' | 'pattern' | 'manual' | 'kink' | 'sync',
  title: string,
  Icon: React.FC<SvgProps>,
  onPress?: () => void
}