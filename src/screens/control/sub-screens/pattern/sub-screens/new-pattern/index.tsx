import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
} from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { FULL_SIZE } from "@common/constant";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { BackButton } from "@common/components/back-button";
import { spacings } from "@common/styles/spacings";
import { BaseText } from "@common/components/base-text";
import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../../../../App";
import { usePattern } from "./hooks";
import { useContext } from "react";
import { GlobalContext } from "../../../../../../store";
import Heart from "@images/icons/heart.svg";
import HeartFill from "@images/icons/heart-fill.svg";

export const NewPattern: React.FC = () => {
  const { handleStartPatternPress, handleReturnPress } = usePattern();
  const { globalState, setGlobalState } = useContext(GlobalContext);

  let item = null;
  if (globalState.tmp_pattern.length > 0) {
    item = globalState.tmp_pattern[globalState.tmp_pattern.length - 1];
  }

  const title = item?.title;
  const Icon = item?.Icon;
  const onPress = item?.onPress;
  const description = item?.description;
  const favorite = item?.favorite;
  const hideFavorite = item?.hideFavorite;

  return (
    <ScreenWrapper disableScrolling>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>
            New pattern{"\n"} has been generated!
          </Text>
        </View>

        <TouchableOpacity style={styles.cards} onPress={onPress}>
          <TouchableOpacity style={styles.favorite}>
            {hideFavorite || (favorite ? <HeartFill /> : <Heart />)}
          </TouchableOpacity>
          <View
            style={[
              styles.cardContainer,
              description || title ? styles.cardWithText : null,
              title ? styles.cardWithTitleOnly : null,
              description ? styles.cardWithTitleDescription : null,
            ]}
          >
            <Icon />
            <View style={styles.contentContainer}>
              {title && (
                <BaseText
                  style={[
                    styles.contentText,
                    description ? styles.descriptionPaddingTop : null,
                  ]}
                >
                  {title}
                </BaseText>
              )}
              {description && (
                <BaseText
                  style={[styles.contentText, styles.controlDescription]}
                >
                  {description}
                </BaseText>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.Bottom}>
          {/* Start Button */}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleStartPatternPress}
          >
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>

          {/* Return Button */}
          <TouchableOpacity
            style={styles.returnButton}
            onPress={handleReturnPress}
          >
            <Text style={styles.returnText}>Return</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: "hidden",
    width: FULL_SIZE,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleContainer: {
    width: FULL_SIZE,
    paddingHorizontal: spacings.w16,
    paddingTop: spacings.h16,
    paddingBottom: spacings.h34,
    display: "flex",
  },
  titleText: {
    color: colors.white,
    fontSize: fontSizes.large,
    fontWeight: fontWeights.bold,
    textAlign: "center",
    fontFamily: "Quicksand-Bold",
  },
  Bottom: {
    justifyContent: "center",
    width: FULL_SIZE,
    paddingHorizontal: spacings.w16,
    paddingBottom: spacings.h34,
    alignItems: "center",
  },
  saveButton: {
    borderRadius: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: colors.grayLightest,
    paddingVertical: 16,
  },
  saveText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    textAlign: "center",
    height: 23,
  },
  returnButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  returnText: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    height: 23,
  },
  favorite: {
    position: "absolute",
    top: 0,
    right: 0,
    padding: spacings.h16,
  },
  cards: {
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: spacings.w18,
    minWidth: 160,
    height: 156,
    marginHorizontal: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: spacings.h16,
  },
  cardContainer: {
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
  },
  cardWithText: {
    position: "absolute",
    height: FULL_SIZE,
  },
  cardWithTitleOnly: {
    justifyContent: "space-between",
    bottom: spacings.h16,
  },
  cardWithTitleDescription: {
    height: "auto",
    bottom: spacings.h24,
  },
  contentContainer: {
    display: "flex",
    flexDirection: "column",
    gap: spacings.h6,
  },
  contentText: {
    fontWeight: fontWeights.bold,
    flexWrap: "wrap",
    color: colors.white,
    fontSize: fontSizes.small,
    alignSelf: "center",
  },
  descriptionPaddingTop: {
    paddingTop: spacings.h18,
  },
  controlDescription: {
    fontSize: fontSizes.xsmall,
    fontWeight: fontWeights.normal,
  },
  cardsContainer: {
    paddingTop: spacings.h36,
    gap: spacings.h16,
  },
});
