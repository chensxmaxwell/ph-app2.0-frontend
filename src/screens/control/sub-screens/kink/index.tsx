import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenWrapper } from '@common/components/screen-wrapper';
import { FULL_SIZE } from '@common/constant';
import { colors } from '@common/styles/colors';
import { fontSizes, fontWeights } from '@common/styles/fonts';
import { BaseText } from '@common/components/base-text';
import { spacings } from '@common/styles/spacings';
import { useKink } from './hooks';
import { BackButton } from '@common/components/back-button';
import Lightbulb from '@images/icons/lightbulb.svg';
import { ConnectionPill } from '@common/components/connection-pill';
import { TabBar } from '../sub-components/tab-bar';
import { CardsList } from '../sub-components/cards-list';

export const Kink = () => {
  const {
    tabs,
    selectedTab,
    handleLightbulbPress,
    kinks,
  } = useKink();

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <BackButton />
          <BaseText style={styles.titleText}>Kink</BaseText>
          <TouchableOpacity onPress={() => handleLightbulbPress()}>
            <Lightbulb />
          </TouchableOpacity>
        </View>
        <ConnectionPill />
        <TabBar
          tabs={tabs}
          selectedTab={selectedTab}
        />
        <CardsList cards={kinks} />
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: 'hidden',
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
});
