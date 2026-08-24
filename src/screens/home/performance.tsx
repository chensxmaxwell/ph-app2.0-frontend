import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { NavigationType } from "../../../App";
import { SimplePage } from "../shared/simple-page";

const PERFORMANCES = [
  { title: "Hardcore", detail: "High-energy and intense" },
  { title: "Gentle", detail: "Soft and even" },
  { title: "Lazy", detail: "Low-intensity and smooth" },
  { title: "Playful", detail: "Fun and unexpected" },
  { title: "Dominant", detail: "Sharp and fast" },
];

export const PerformanceScreen = () => {
  const navigation = useNavigation<NavigationType>();

  return (
    <SimplePage title="Performance" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.list}>
        {PERFORMANCES.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.card}
            onPress={() =>
              navigation.navigate(SCREENS.PERFORMANCE_PLAY as never, {
                title: item.title,
              } as never)
            }
          >
            <View style={styles.orb} />
            <View style={styles.copy}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.detail}>{item.detail}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: colors.grayLight,
    borderRadius: 16,
    minHeight: 90,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  orb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(204, 160, 221, 0.55)",
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  detail: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});
