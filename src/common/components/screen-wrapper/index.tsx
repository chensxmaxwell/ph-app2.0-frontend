import { useRoute } from "@react-navigation/native";
import React, { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FULL_WINDOW_WIDTH } from "../../constant";
import { globalStyles } from "../../styles/globalStyles";
import { spacings } from "../../styles/spacings";
import { NavigationTab, NavigationTabProps } from "../navigation-tab";

import {
  FooterWaveSvgBackground,
  FooterWaveSvgBackgroundTypes,
} from "./sub-components/footer-wavy-svg-background";
import {
  HeaderWaveSvgBackground,
  HeaderWaveSvgBackgroundProps,
} from "./sub-components/header-wave-svg-background";
import { useScreenWrapper } from "./hooks";
import LinearGradient from "react-native-linear-gradient";
import { BackButton } from "../back-button";

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  backgroundType,
  footerType,
  showCloseButton,
  children,
  disableScrolling,
  showNavBar,
  headerType,
  withNavBar,
  paddingHorizontal = "small",
}) => {
  const route = useRoute();
  const { getBackgroundTypeConfig } = useScreenWrapper();

  const paddingHorizontalValue =
    paddingHorizontal === "large" ? spacings.w32 : spacings.w24;

  return (
    <LinearGradient
      style={[styles.container, withNavBar && { paddingBottom: spacings.h50 }]}
      {...getBackgroundTypeConfig(backgroundType)}
    >
      {headerType && <HeaderWaveSvgBackground type={headerType} />}
      <SafeAreaView style={styles.safeArea}>
        {showCloseButton && (
          <View style={styles.backButton}>
            <BackButton />
          </View>
        )}
        {disableScrolling ? (
          <View style={styles.fill}>{children}</View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollViewContent,
              { paddingHorizontal: paddingHorizontalValue },
            ]}
          >
            {children}
          </ScrollView>
        )}
      </SafeAreaView>
      {showNavBar && (
        <NavigationTab
          style={styles.navBar}
          activeRoute={route.name as NavigationTabProps["activeRoute"]}
        />
      )}
      {footerType && <FooterWaveSvgBackground type={footerType} />}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { ...globalStyles.container, flex: 1 },
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  backButton: {
    left: FULL_WINDOW_WIDTH * 0.05,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 29,
  },
  scrollViewContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: spacings.w24,
  },
  navBar: { bottom: spacings.h40 },
});

export type ScreenWrapperProps = {
  backgroundType?: string;
  children: ReactNode | ReactNode[];
  showCloseButton?: boolean;
  showNavBar?: boolean;
  footerType?: FooterWaveSvgBackgroundTypes;
  headerType?: HeaderWaveSvgBackgroundProps["type"];
  disableScrolling?: boolean;
  isBleConnectionScreen?: boolean;
  withNavBar?: boolean;
  paddingHorizontal?: "small" | "large";
};
