import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useHome } from "./hooks";
import House from "@images/3d-rendering-cartoon-house.svg";
import AddIcon from "@images/AddIcon.svg";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { FULL_SIZE, SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { BaseText } from "@common/components/base-text";
import { spacings } from "@common/styles/spacings";
import { useNavigation, NavigationProp, ParamListBase } from "@react-navigation/native";
import { lookFromCompanion, useCompanions } from "../../store/companions";
import { s } from "../avatar/scale";
import { AvatarPreview } from "../avatar/engine/AvatarPreview";
import { LookFace } from "../avatar/look-face";
import { useOpenLove } from "../love/pill";
import { useProfile } from "../profile/hooks";

export const Home = () => {
  const { companions, events, navigateToNestedScreen } = useHome();
  const { displayName } = useProfile();
  const {
    companions: createdCompanions,
    activeCompanion,
    activeCompanionId,
  } = useCompanions();
  const navigation = useNavigation();
  const parentNavigation = navigation.getParent() as
    | NavigationProp<ParamListBase>
    | undefined;
  const openLove = useOpenLove();
  const selectedMock = companions.find(
    (companion) => companion.id === activeCompanionId
  );

  const openAvatarCreation = () => {
    parentNavigation?.navigate(
      SCREENS.AVATAR_STACK as never,
      { mode: "create" } as never
    );
  };

  const openCompanion = (companionId: string, name: string) => {
    openLove({ companionId, name });
  };

  const renderCreatedCompanions = () =>
    createdCompanions.map((companion) => (
      <TouchableOpacity
        key={companion.id}
        style={styles.companionPicture}
        onPress={() => openCompanion(companion.id, companion.name)}
      >
        <LookFace look={lookFromCompanion(companion)} size={70} />
      </TouchableOpacity>
    ));

  const renderCompanions = () =>
    companions
      .filter(
        (companion) =>
          !createdCompanions.some((created) => created.id === companion.id)
      )
      .map((companion) => (
        <TouchableOpacity
          key={companion.id}
          style={styles.companionPicture}
          onPress={() => openCompanion(companion.id, companion.name)}
        >
          {companion.profilePicture && (
            <companion.profilePicture height="100%" width="100%" />
          )}
        </TouchableOpacity>
      ));

  const generatePath = (screens: string[]) => {
    return screens.map((screen) => ({
      screen,
    }));
  };

  const renderRecentEvents = () =>
    events.map((event, index) => {
      const dynamicPath = generatePath(event.forward);

      return (
        <TouchableOpacity
          key={index}
          style={[styles.cards, styles.events]}
          onPress={() => {
            if (event.screen) {
              parentNavigation?.navigate(event.screen, event.params);
              return;
            }
            navigateToNestedScreen({
              navigation: navigation as NavigationProp<any>,
              path: dynamicPath,
            });
          }}
        >
          <View style={styles.eventContainer}>
            {event.icon && <event.icon height={60} width={60} />}
            <View style={styles.eventDescriptionContainer}>
              <BaseText style={styles.eventDescriptionTitle}>
                {event.title}
              </BaseText>
              <BaseText style={styles.eventDescriptionDetail}>
                {event.detail}
              </BaseText>
            </View>
          </View>
        </TouchableOpacity>
      );
    });

  return (
    <ScreenWrapper withNavBar>
      <View style={styles.container}>
        <BaseText style={styles.pleasureHouse}>Pleasure House</BaseText>
        <BaseText style={styles.userName}>{displayName}</BaseText>
        <View style={styles.hero}>
          {activeCompanion ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                openCompanion(activeCompanion.id, activeCompanion.name)
              }
            >
              <AvatarPreview
                look={lookFromCompanion(activeCompanion)}
                width={s(300)}
                height={s(300)}
              />
            </TouchableOpacity>
          ) : selectedMock ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => openCompanion(selectedMock.id, selectedMock.name)}
              style={styles.mockHero}
            >
              {selectedMock.profilePicture ? (
                <selectedMock.profilePicture height="100%" width="100%" />
              ) : null}
            </TouchableOpacity>
          ) : (
            <House />
          )}
        </View>
        <View style={styles.cardContainer}>
          <BaseText style={styles.companionsText}>My Companions</BaseText>
          <View style={[styles.companions, styles.cards]}>
            <ScrollView
              horizontal
              style={styles.companionsScrollView}
              showsHorizontalScrollIndicator={false}
            >
              {renderCreatedCompanions()}
              {renderCompanions()}
              <TouchableOpacity
                style={styles.addCompanion}
                onPress={openAvatarCreation}
              >
                <AddIcon width={28} height={28} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        <View style={[styles.cardContainer, styles.recentContainer]}>
          <TouchableOpacity
            onPress={() => parentNavigation?.navigate(SCREENS.PERFORMANCE)}
          >
            <BaseText style={styles.companionsText}>Recent</BaseText>
          </TouchableOpacity>
          <View style={styles.eventsContainer}>{renderRecentEvents()}</View>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    height: FULL_SIZE,
    overflow: "visible",
    width: FULL_SIZE,
    display: "flex",
    alignItems: "center",
  },
  pleasureHouse: {
    fontFamily: "AngryPortraitToumpano",
    fontSize: fontSizes.largeX,
  },
  userName: {
    marginTop: spacings.h6,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.smallX,
    fontWeight: fontWeights.bold,
  },
  hero: {
    width: FULL_SIZE,
    alignItems: "center",
    overflow: "visible",
  },
  mockHero: {
    width: s(180),
    height: s(180),
    borderRadius: s(90),
    overflow: "hidden",
    marginTop: spacings.h16,
  },
  cardContainer: {
    display: "flex",
    width: FULL_SIZE,
    paddingHorizontal: spacings.h12,
    gap: spacings.h16,
  },
  companionsText: {
    fontSize: fontSizes.medium2X,
    fontWeight: "bold",
    lineHeight: 25,
    textAlign: "left",
  },
  cards: {
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    justifyContent: "center",
  },
  companions: {
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacings.w12,
  },
  companionsScrollView: {
    display: "flex",
    flexDirection: "row",
  },
  companionPicture: {
    width: 70,
    height: 70,
    marginRight: spacings.w12,
    overflow: "hidden",
    borderRadius: 50,
  },
  companionImage: {
    width: "100%",
    height: "100%",
  },
  addCompanion: {
    width: 70,
    height: 70,
    marginRight: spacings.w12,
    borderRadius: 50,
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
  },
  recentContainer: {
    marginTop: spacings.h24,
  },
  eventsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: spacings.h12,
  },
  eventsIcon: {
    marginRight: spacings.w12,
  },
  eventContainer: {
    display: "flex",
    flexDirection: "row",
    gap: spacings.w32,
    alignItems: "center",
    paddingVertical: spacings.h12,
  },
  events: {
    minHeight: 90,
    paddingHorizontal: spacings.w18,
  },
  eventDescriptionContainer: {
    display: "flex",
    flexDirection: "column",
    gap: spacings.h12,
    flex: 1,
  },
  eventDescriptionTitle: {
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.smallX,
  },
  eventDescriptionDetail: {
    fontWeight: fontWeights.bold,
    flexWrap: "wrap",
    color: colors.grayLighter,
    fontSize: fontSizes.xsmall,
  },
});
