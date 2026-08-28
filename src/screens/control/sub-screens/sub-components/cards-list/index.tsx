import React from "react";
import { FlatList, ListRenderItem, StyleSheet, TouchableOpacity, View } from "react-native";
import { SvgProps } from 'react-native-svg';
import Heart from '@images/icons/heart.svg';
import HeartFill from '@images/icons/heart-fill.svg';
import { FULL_SIZE } from "@common/constant";
import { BaseText } from "@common/components/base-text";
import { spacings } from "@common/styles/spacings";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";

const renderCards: ListRenderItem<CardType> = ({ item }) => {
    const {
        title,
        Icon,
        onPress,
        description,
        favorite,
        hideFavorite,
        onFavoritePress,
    } = item;

    return (
        <TouchableOpacity
            style={styles.cards}
            onPress={onPress}
        >
            {hideFavorite ? null : onFavoritePress ? (
                <TouchableOpacity
                    style={styles.favorite}
                    onPress={onFavoritePress}
                    hitSlop={8}
                >
                    {favorite ? <HeartFill /> : <Heart />}
                </TouchableOpacity>
            ) : (
                <View style={styles.favorite} pointerEvents="none">
                    {favorite ? <HeartFill /> : <Heart />}
                </View>
            )}
            <View style={[
                styles.cardContainer,
                (description || title) ? styles.cardWithText : null,
                title ? styles.cardWithTitleOnly : null,
                description ? styles.cardWithTitleDescription : null,
            ]}>
                <Icon />
                <View style={styles.contentContainer}>
                    {title &&
                        <BaseText style={[
                            styles.contentText,
                            description ? styles.descriptionPaddingTop : null
                        ]}>{title}</BaseText>
                    }
                    {description &&
                        <BaseText style={[styles.contentText, styles.controlDescription]}>
                            {description}
                        </BaseText>
                    }
                </View>
            </View>
        </TouchableOpacity>
    )
};

export const CardsList: React.FC<CardsListProps> = ({ cards }) => (
    <FlatList
        data={cards}
        renderItem={renderCards}
        keyExtractor={(_, index) => index.toString()}
        numColumns={2}
        contentContainerStyle={styles.cardsContainer}
        columnWrapperStyle={styles.columnWrapper}
    />
)

export type CardsListProps = {
    cards: CardType[]
}

export type CardType = {
    title?: string,
    Icon: React.FC<SvgProps>,
    onPress?: () => void,
    description?: string,
    favorite?: boolean,
    hideFavorite?: boolean,
    onFavoritePress?: () => void,
    pattern?: number[],
}

const styles = StyleSheet.create({
    favorite: {
        position: 'absolute',
        top: 0,
        right: 0,
        padding: spacings.h16
    },
    cards: {
        backgroundColor: colors.grayLight,
        borderRadius: 10,
        justifyContent: 'center',
        paddingHorizontal: spacings.w18,
        minWidth: 160,
        height: 156,
        marginHorizontal: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: spacings.h16,
    },
    cardContainer: {
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
    },
    cardWithText: {
        position: 'absolute',
        height: FULL_SIZE,
    },
    cardWithTitleOnly: {
        justifyContent: 'space-between',
        bottom: spacings.h16,
    },
    cardWithTitleDescription: {
        height: 'auto',
        bottom: spacings.h24,
    },
    contentContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: spacings.h6
    },
    contentText: {
        fontWeight: fontWeights.bold,
        flexWrap: 'wrap',
        color: colors.white,
        fontSize: fontSizes.small,
        alignSelf: 'center',
    },
    descriptionPaddingTop: {
        paddingTop: spacings.h18
    },
    controlDescription: {
        fontSize: fontSizes.xsmall,
        fontWeight: fontWeights.normal,
    },
    cardsContainer: {
        paddingTop: spacings.h36,
        gap: spacings.h16,
    },
    columnWrapper: {
        justifyContent: 'space-between', // Ensure space between columns
    },
});
