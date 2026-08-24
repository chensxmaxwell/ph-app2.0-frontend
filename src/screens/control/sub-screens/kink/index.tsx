import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@common/components/screen-wrapper';
import { FULL_SIZE } from '@common/constant';
import { colors } from '@common/styles/colors';
import { fontSizes, fontWeights } from '@common/styles/fonts';
import { BaseText } from '@common/components/base-text';
import { spacings } from '@common/styles/spacings';
import { useKink } from './hooks';
import { BackButton } from '@common/components/back-button';
import { ConnectionPill } from '@common/components/connection-pill';
import { CardsList } from '../sub-components/cards-list';

export const KinkHub = () => {
  const { kinks } = useKink();

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <BackButton />
          <BaseText style={styles.titleText}>Kink</BaseText>
          <View style={styles.titleSpacer} />
        </View>
        <ConnectionPill />
        <CardsList cards={kinks} />
      </View>
    </ScreenWrapper>
  );
};

export const Kink = KinkHub;

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
  titleSpacer: {
    width: 35,
    height: 35,
  },
});
