import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenWrapper } from '@common/components/screen-wrapper';
import { FULL_SIZE, FULL_WINDOW_HEIGHT, FULL_WINDOW_WIDTH } from '@common/constant';
import { colors } from '@common/styles/colors';
import { fontSizes, fontWeights } from '@common/styles/fonts';
import { BaseText } from '@common/components/base-text';
import { spacings } from '@common/styles/spacings';
import { useManual } from './hooks';
import { BackButton } from '@common/components/back-button';
import Lightbulb from '@images/icons/lightbulb.svg';
import PlayButton from '@images/arrowtriangle-right.svg';
import PauseButton from '@images/pause.svg';
import { SeekBarVertical } from './sub-components/seek-bar-vertical';
import { SessionLovePill } from '../../../love/pill';
import { s } from '../../../avatar/scale';

export const Manual = () => {
  const {
    currentValue,
    handleLevelChange,
    handleLightbulbPress,
    handlePlayButtonPress,
    playing,
  } = useManual();

  const seakBarProps = {
    width: FULL_WINDOW_WIDTH * 0.47, // 180,
    height: FULL_WINDOW_HEIGHT * 0.435, //372,
  };

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <BackButton />
          <BaseText style={styles.titleText}>Manual</BaseText>
          <TouchableOpacity onPress={() => handleLightbulbPress()}>
            <Lightbulb />
          </TouchableOpacity>
        </View>
        <BaseText>Current Level</BaseText>
        <BaseText style={styles.levelText}>{currentValue}</BaseText>
        <SeekBarVertical
          handleValueChange={handleLevelChange}
          {...seakBarProps}
        />
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => handlePlayButtonPress()}
        >
          {playing ? <PauseButton /> : <PlayButton />}
        </TouchableOpacity>
        <SessionLovePill style={{ top: s(80) }} />
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: 'visible',
    width: FULL_SIZE,
    display: 'flex',
    alignItems: 'center',
  },
  titleContainer: {
    width: FULL_SIZE,
    paddingHorizontal: spacings.w16,
    paddingTop: spacings.h16,
    paddingBottom: spacings.h34,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    color: colors.white,
    fontSize: fontSizes.large,
    fontWeight: fontWeights.bold,
  },
  cardContainer: {
    paddingTop: spacings.h85,
    gap: spacings.h16,
  },
  columnWrapper: {
    justifyContent: 'space-between', // Ensure space between columns
  },
  cards: {
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    justifyContent: 'space-between',
    paddingHorizontal: spacings.w18,
    minWidth: 160,
    minHeight: 156,
    marginHorizontal: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacings.h16,
  },
  controlTitle: {
    fontWeight: fontWeights.bold,
    flexWrap: 'wrap',
    color: colors.white,
    fontSize: fontSizes.smallX,
  },
  levelText: {
    paddingTop: spacings.h16,
    paddingBottom: spacings.h50,
    fontSize: fontSizes.largeX,
    fontWeight: fontWeights.bold,
    lineHeight: (4 / 3) * fontSizes.largeX
  },
  playButton: {
    marginTop: spacings.h50,
    backgroundColor: colors.grayLightest,
    width: spacings.w100,
    height: spacings.w100,
    borderRadius: spacings.w100,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
