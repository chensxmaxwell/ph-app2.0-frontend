import React, { useState } from 'react';
import { Tab } from '../sub-components/tab-bar';
import NewKink from '@images/icons/new-kink.svg';
import Hardcore from '@images/icons/hardcore.svg';
import Gentle from '@images/icons/gentle.svg';
import Lazy from '@images/icons/lazy.svg';
import Playful from '@images/icons/playful.svg';
import Random from '@images/icons/random.svg';
import Dominant from '@images/icons/dominant.svg';
import Plus from '@images/icons/plus.svg';
import { View } from 'react-native';
import { colors } from '@common/styles/colors';
import { CardType } from '../sub-components/cards-list';
import { useNavigation } from '@react-navigation/native';
import { NavigationType } from '../../../../../App';
import { SCREENS } from '@common/constant';
import { BUILTIN_PATTERNS, wavePattern } from '../../../../store/patterns';

const renderNewKink: React.FC = () => {
  return (
    <View style={{
      backgroundColor: colors.grayLightest,
      width: 75.5,
      height: 75.5,
      borderRadius: 75.5,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <NewKink />
    </View>
  );
};

export const useKink = () => {
  const navigation = useNavigation<NavigationType>();
  const [selectedTab, setSelectedTab] = useState('patterns');
  const handleTabSelect = (value: string) => {
    setSelectedTab(value);
  };
  const [tabs, _] = useState<Tab[]>([
    {
      title: 'Patterns',
      value: 'patterns',
      onPress: () => handleTabSelect('patterns')
    },
    {
      title: 'Saved',
      value: 'saved',
      onPress: () => handleTabSelect('saved')
    },
    {
      title: 'Generated',
      value: 'generated',
      onPress: () => handleTabSelect('generated')
    },
    {
      title: 'Recent',
      value: 'recent',
      onPress: () => handleTabSelect('recent')
    },
  ]);

  const handleLightbulbPress = () => {};
  const play = (title: string, peak = 80) =>
    navigation.navigate(SCREENS.DISPLAY_PATTERN, {
      title,
      pattern:
        BUILTIN_PATTERNS.find((item) => item.title === title)?.pattern ??
        wavePattern(peak),
    });

  // *TODO: Get patterns from API
  const kinks: CardType[] = [
    {
      Icon: Plus,
      title: 'Generate',
      description: 'Generate your own fun',
      onPress: () => navigation.navigate(SCREENS.KINK),
      hideFavorite: true,
    },
    {
      Icon: Hardcore,
      title: 'Hardcore',
      description: 'High-energy and intense',
      onPress: () => play('Hardcore', 100),
      favorite: true,
    },
    {
      Icon: Gentle,
      title: 'Gentle',
      description: 'Soft and even',
      onPress: () => play('Gentle', 42),
    },
    {
      Icon: Lazy,
      title: 'Lazy',
      description: 'Low-intensity and smooth',
      onPress: () => play('Lazy', 28),
    },
    {
      Icon: Playful,
      title: 'Playful',
      description: 'Fun and unexpected',
      onPress: () => play('Playful', 70),
    },
    {
      Icon: Random,
      title: 'Random',
      description: 'Surprise!',
      onPress: () => play('Random', 88),
    },
    {
      Icon: Dominant,
      title: 'Dominant',
      description: 'Sharp and fast',
      onPress: () => play('Dominant', 96),
    },
    {
      Icon: renderNewKink,
      title: 'Untitled',
      onPress: () => play('Untitled'),
    },
  ];

  return {
    tabs,
    selectedTab,
    handleLightbulbPress,
    kinks
  };
};
