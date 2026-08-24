import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";

import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import ChevronLeft from "@images/chevron-left-white.svg";
import HeartFull from "@images/heartFull.svg";
import HeartOutline from "@images/heartOutline.svg";
import Pattern1 from "@images/pattern1.svg";
import untitled from "@images/untitled.svg";
import Pattern3 from "@images/pattern3.svg";
import Pattern4 from "@images/pattern4.svg";
import Pattern5 from "@images/pattern5.svg";
import Pattern6 from "@images/pattern6.svg";
import Pattern7 from "@images/pattern7.svg";
import Pattern8 from "@images/pattern8.svg";
import { BUILTIN_PATTERNS } from "../../store/patterns";
import { setAlarmDraft } from "../../store/alarms";

const patternData = [
  { id: 1, name: "Pulse", icon: Pattern1, pattern: BUILTIN_PATTERNS[1].pattern },
  { id: 2, name: "Untitled", icon: untitled, pattern: BUILTIN_PATTERNS[0].pattern },
  { id: 3, name: "Wave", icon: Pattern3, pattern: BUILTIN_PATTERNS[2].pattern },
  { id: 4, name: "Stagger", icon: Pattern4, pattern: BUILTIN_PATTERNS[3].pattern },
  { id: 5, name: "Pulse", icon: Pattern5, pattern: BUILTIN_PATTERNS[1].pattern },
  { id: 6, name: "Wave", icon: Pattern6, pattern: BUILTIN_PATTERNS[2].pattern },
  { id: 7, name: "Stagger", icon: Pattern7, pattern: BUILTIN_PATTERNS[3].pattern },
  { id: 8, name: "Untitled", icon: Pattern8, pattern: BUILTIN_PATTERNS[0].pattern },
];

interface PatternItem {
  id: number;
  icon: any;
  name: string;
  pattern: number[];
}

const ChoosePatternScreen = () => {
  const navigation = useNavigation();
  const [selectedPattern, setSelectedPattern] = useState<number | null>(null);

  const renderItem = ({ item }: { item: PatternItem }) => {
    return (
      <TouchableOpacity
        style={[
          styles.card,
          selectedPattern === item.id && styles.selectedCard,
        ]}
        onPress={() => {
          setSelectedPattern(item.id);
          setAlarmDraft({
            patternTitle: item.name || "Untitled",
            pattern: item.pattern,
          });
          navigation.goBack();
        }}
      >
        {item.name === "Untitled" ? (
          <View style={styles.roundIconBackground}>
            <item.icon width={120} height={80} />
          </View>
        ) : (
          <item.icon width={120} height={80} />
        )}
        {item.name ? (
          <Text style={styles.patternName}>{item.name}</Text>
        )}
        <View style={styles.heartIcon}>
          {selectedPattern === item.id ? (
            <HeartFull width={35} height={35} />
          ) : (
            <HeartOutline width={35} height={35} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
      ></LinearGradient>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Choose Pattern</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>

      {/* Pattern Grid */}
      <FlatList
        data={patternData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 60,
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginBottom: 40,
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

  card: {
    borderRadius: 20,
    padding: 16,
    margin: 8,
    width: 160,
    height: 155,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.grayLightest,
  },
  selectedCard: {
    backgroundColor: colors.grayLightest,
  },
  roundIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.grayLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  patternName: {
    fontSize: fontSizes.small,
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontWeight: fontWeights.bold,
    position: "absolute",
    bottom: 20,
  },
  heartIcon: {
    position: "absolute",
    top: 8,
    right: 8,
  },
});

export default ChoosePatternScreen;
