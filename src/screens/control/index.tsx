
import React from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, ListRenderItem } from 'react-native';
import { ControlType, useControl } from './hooks';
import { ScreenWrapper } from '@common/components/screen-wrapper';
import { FULL_SIZE } from '@common/constant';
import { colors } from '@common/styles/colors';
import { fontSizes, fontWeights } from '@common/styles/fonts';
import { BaseText } from '@common/components/base-text';
import { spacings } from '@common/styles/spacings';
import { ConnectionPill } from '@common/components/connection-pill';
import { SessionLovePill } from '../love/pill';
import { s } from '../avatar/scale';

export const Control = () => {
  const { controls } = useControl();

  const renderControls: ListRenderItem<ControlType> = ({ item }) => {
    const { title, Icon, onPress } = item;

    return (
      <TouchableOpacity style={styles.cards}
        onPress={onPress} >
        <Icon />
        <View >
          <BaseText style={styles.controlTitle}>{title}</BaseText>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <ConnectionPill />
        <FlatList
          data={controls}
          renderItem={renderControls}
          keyExtractor={(item, index) => index.toString()}
          numColumns={2}
          contentContainerStyle={styles.cardContainer}
          columnWrapperStyle={styles.columnWrapper}
        />
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
  }
});
