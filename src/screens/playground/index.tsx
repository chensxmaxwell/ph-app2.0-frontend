import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import LinearGradient from "react-native-linear-gradient";
import { FULL_SIZE } from "@common/constant";
import GreenIcon from "@images/greenIcon.svg";
import ChevronLeftfrom from "@images/chevron-left-white.svg";
import { spacings } from "@common/styles/spacings";
import { BaseText } from "@common/components/base-text";
import { usePlayground } from "./hooks";
import { useHomeScreen } from "../../hooks/HomeScreenContext";
import RedIcon from "@images/redIcon.svg";
import { ConnectionPill } from "@common/components/connection-pill";

export const Playground = () => {
  const { playgroundOptions, navigation } = usePlayground();

  const { isConnected } = useHomeScreen();

  const renderContent = () =>
    playgroundOptions.map((playgroundOption) => {
      const { id, name, detail, time, onPress } = playgroundOption;
      return (
        <TouchableOpacity key={id} onPress={onPress}>
          <View style={[styles.cards, styles.events]}>
            <View style={styles.playgroundContainer}>
              <playgroundOption.icon width={60} height={60} />
              <View style={styles.playgroundDescriptionContainer}>
                <BaseText style={styles.playgroundDescriptionTitle}>
                  {name}
                </BaseText>
                <View>
                  <BaseText style={styles.playgroundDescriptionDetail}>
                    {detail}
                  </BaseText>
                  {time && (
                    <BaseText style={styles.playgroundTime}>{time}</BaseText>
                  )}
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    });
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#2B2358", "#2B2358"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["#5E5DBF", "rgba(50, 41, 105, 0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Playground</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftfrom width={35} height={35} />
        </TouchableOpacity>
      </View>

      {/* Connected Status */}
      <ConnectionPill />

      {/* Render content based on the active tab */}
      <ScrollView>
        <View style={styles.cardContainer}>
          <View style={styles.eventsContainer}>{renderContent()}</View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  backIcon: {
    position: "absolute",
    left: 20,
    top: 0,
    width: 35,
    height: 35,
  },
  lightbulbIcon: {
    position: "absolute",
    right: 20,
    top: 0,
    width: 35,
    height: 35,
  },
  connectedContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "space-between",
    backgroundColor: colors.grayLightest,
    borderWidth: 1,
    borderColor: colors.white,
    marginVertical: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 50,
    width: 220,
  },
  connectedText: {
    color: colors.white,
    fontSize: fontSizes.medium,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
  },
  batteryText: {
    color: colors.grayLighter,
    fontSize: fontSizes.medium,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 32,
    borderBottomWidth: 2,
    borderBottomColor: colors.white,
    paddingBottom: 8,
    marginHorizontal: 16,
  },
  tab: {
    color: colors.grayLighter,
    fontSize: fontSizes.medium,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
  },
  tabText: {
    color: colors.white,
    fontSize: fontSizes.medium,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
  },
  contentContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  flatListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    margin: 8,
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.grayLightest,
    position: "relative",
  },
  selectedCard: {
    backgroundColor: colors.grayLightest,
  },
  icon: {
    position: "absolute",
    top: 30,
  },
  roundIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.grayLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
    position: "absolute",
    top: 30,
  },
  kinkName: {
    fontSize: fontSizes.small,
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontWeight: fontWeights.bold,
    position: "absolute",
    height: 15,
    bottom: 50,
  },
  untitleName: {
    bottom: 30,
  },
  kinkText: {
    fontSize: 10,
    color: colors.white,
    fontFamily: "OpenSans-Regular",
    position: "absolute",
    height: 11,
    bottom: 30,
  },
  heartIcon: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  deleteIcon: {
    position: "absolute",
    top: -5,
    left: -5,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 4,
    zIndex: 1,
  },
  playgroundContainer: {
    display: "flex",
    flexDirection: "row",
    gap: spacings.w16,
    alignItems: "center",
    paddingVertical: spacings.h16,
  },
  events: {
    minHeight: 90,
    paddingHorizontal: spacings.w18,
  },
  playgroundDescriptionContainer: {
    display: "flex",
    flexDirection: "column",
    gap: spacings.h12,
    flex: 1,
  },
  playgroundDescriptionTitle: {
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.smallX,
  },
  playgroundDescriptionDetail: {
    fontWeight: fontWeights.bold,
    flexWrap: "wrap",
    color: colors.grayLighter,
    fontSize: fontSizes.xsmall,
  },
  playgroundTime: {
    fontWeight: fontWeights.bold,
    flexWrap: "wrap",
    color: colors.white,
    fontSize: fontSizes.xsmall,
  },
  cards: {
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    justifyContent: "center",
  },
  cardContainer: {
    display: "flex",
    width: FULL_SIZE,
    paddingHorizontal: spacings.h12,
    gap: spacings.h16,
    marginTop: spacings.h40,
  },
  eventsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: spacings.h16,
  },
});
