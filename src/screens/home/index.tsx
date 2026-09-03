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
import {
  useNavigation,
  NavigationProp,
  ParamListBase,
} from "@react-navigation/native";
import { LookFace } from "../avatar/look-face";
import { ROW_AVATAR_SIZE, circleAvatarStyle } from "../avatar/circle-avatar";
import { openCreateCompanion } from "../avatar/open";
import { faceSourceForId } from "../chat/faces";
import type { ChatKind } from "../chat/types";
import type { AvatarLook } from "../avatar/engine/viewer-html";
import { useHomeCompanions } from "./companions";

const HomeFace = ({
  companionId,
  kind,
  look,
  size,
}: {
  companionId: string;
  kind: ChatKind;
  look?: AvatarLook | null;
  size: number;
}) => (
  <LookFace
    look={look}
    size={size}
    fallbackSource={faceSourceForId(companionId, kind)}
  />
);

export const Home = () => {
  const { events, navigateToNestedScreen } = useHome();
  // One membership with the Message friends list: see ./companions.ts.
  const companions = useHomeCompanions();
  const navigation = useNavigation();
  const parentNavigation = navigation.getParent() as
    | NavigationProp<ParamListBase>
    | undefined;
  const openAvatarCreation = () => {
    openCreateCompanion(
      parentNavigation ?? (navigation as NavigationProp<ParamListBase>)
    );
  };

  const openCompanion = (companionId: string) => {
    parentNavigation?.navigate(
      SCREENS.CHAT_THREAD as never,
      { threadId: companionId } as never
    );
  };

  const renderCompanions = () =>
    companions.map((companion) => (
      <TouchableOpacity
        key={companion.id}
        testID={`home-companion-${companion.id}`}
        accessibilityLabel={companion.name}
        style={[styles.companionPicture, circleAvatarStyle(ROW_AVATAR_SIZE)]}
        onPress={() => openCompanion(companion.id)}
      >
        <HomeFace
          companionId={companion.id}
          kind={companion.kind}
          look={companion.look}
          size={ROW_AVATAR_SIZE}
        />
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
            if (event.type === "Alarm") {
              parentNavigation?.navigate(SCREENS.PLAYGROUND_STACK, {
                screen: SCREENS.ALARM_STACK,
                params: { screen: SCREENS.SETALARM_INTRO },
              });
              return;
            }
            if (event.screen) {
              parentNavigation?.navigate(event.screen, event.params);
              return;
            }
            navigateToNestedScreen({
              navigation:
                parentNavigation ?? (navigation as NavigationProp<any>),
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
        <View style={styles.hero}>
          <House />
        </View>
        <View style={styles.cardContainer}>
          <BaseText style={styles.companionsText}>My Companions</BaseText>
          <View style={[styles.companions, styles.cards]}>
            <ScrollView
              horizontal
              style={styles.companionsScrollView}
              contentContainerStyle={styles.companionRow}
              showsHorizontalScrollIndicator={false}
            >
              {renderCompanions()}
              <TouchableOpacity
                testID="home-add-companion"
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
  hero: {
    width: FULL_SIZE,
    alignItems: "center",
    overflow: "visible",
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
    flexGrow: 0,
  },
  companionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  companionPicture: {
    marginRight: spacings.w12,
  },
  addCompanion: {
    width: ROW_AVATAR_SIZE,
    height: ROW_AVATAR_SIZE,
    marginRight: spacings.w12,
    borderRadius: ROW_AVATAR_SIZE / 2,
    flexShrink: 0,
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
