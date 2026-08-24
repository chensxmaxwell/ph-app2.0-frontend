import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { useChat } from "../chat/store";
import { SimplePage } from "../shared/simple-page";

const PERKS = [
  "Unlimited messages with friends",
  "Listen to every chat out loud",
  "Priority companion replies",
  "Unlock premium patterns",
];

export const PremiumScreen = () => {
  const navigation = useNavigation();
  const { isPremium, setPremium } = useChat();

  return (
    <SimplePage
      title="Go Premium"
      onBack={() => navigation.goBack()}
      primaryLabel={isPremium ? "You’re Premium" : "Start Premium"}
      onPrimary={() => {
        setPremium(true);
        navigation.goBack();
      }}
      secondaryLabel="Not now"
      onSecondary={() => navigation.goBack()}
    >
      <Text style={styles.lead}>
        Unlock the full Pleasure House experience.
      </Text>
      <View style={styles.list}>
        {PERKS.map((item) => (
          <View key={item} style={styles.row}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.item}>{item}</Text>
          </View>
        ))}
      </View>
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  lead: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
  list: {
    marginTop: 32,
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  item: {
    flex: 1,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
});
