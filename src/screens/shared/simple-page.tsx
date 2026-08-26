import React, { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import ChevronBack from "@images/avatar/chevron-back.svg";
import { ChatGradient } from "../chat/background";
import { s } from "../avatar/scale";

type SimplePageProps = {
  title: string;
  onBack?: () => void;
  hideBack?: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children?: ReactNode;
  contentStyle?: ViewStyle;
};

export const SimplePage = ({
  title,
  onBack,
  hideBack,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  children,
  contentStyle,
}: SimplePageProps) => {
  return (
    <ChatGradient>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          {hideBack ? (
            <View style={styles.headerSide} />
          ) : (
            <TouchableOpacity style={styles.headerSide} onPress={onBack}>
              <ChevronBack width={s(35)} height={s(35)} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSide} />
        </View>
        <View style={[styles.body, contentStyle]}>{children}</View>
        {primaryLabel || secondaryLabel ? (
          <View style={styles.footer}>
            {primaryLabel ? (
              <TouchableOpacity style={styles.primary} onPress={onPrimary}>
                <Text style={styles.primaryText}>{primaryLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {secondaryLabel ? (
              <TouchableOpacity onPress={onSecondary} style={styles.secondaryHit}>
                <Text style={styles.secondaryText}>{secondaryLabel}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.secondaryHit} />
            )}
          </View>
        ) : null}
      </SafeAreaView>
    </ChatGradient>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    minHeight: s(50),
    paddingHorizontal: s(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: {
    width: s(35),
    height: s(35),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
  },
  body: {
    flex: 1,
    paddingHorizontal: s(32),
  },
  footer: {
    paddingHorizontal: s(48),
    paddingBottom: s(16),
    alignItems: "center",
    gap: s(16),
  },
  primary: {
    width: "100%",
    height: s(50),
    borderRadius: 50,
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
  },
  secondaryHit: {
    minHeight: s(20),
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});
