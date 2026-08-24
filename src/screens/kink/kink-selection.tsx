import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Vibration,
  Animated,
} from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import Xmark from "@images/xmark.svg";
import LightBulb from "@images/lightbulb.svg";
import { SCREENS } from "@common/constant";
import GreenIcon from "@images/greenIcon.svg";
import HeartFull from "@images/heartFull.svg";
import HeartOutline from "@images/heartOutline.svg";
import AddIcon from "@images/AddIcon.svg";
import HardCore from "@images/Kink/hardcode.svg";
import Gentle from "@images/Kink/gentle.svg";
import Lazy from "@images/Kink/lazy.svg";
import Playful from "@images/Kink/playful.svg";
import Random from "@images/Kink/random.svg";
import Dominant from "@images/Kink/dominant.svg";
import Untitled from "@images/Kink/untitled.svg";
import DeleteIcon from "@images/Kink/deleteIcon.svg";
import ChevronLeftfrom from "@images/chevron-left-white.svg";
import { useCustomAlert } from "@common/util";
import { useHomeScreen } from "../../hooks/HomeScreenContext";
import RedIcon from "@images/redIcon.svg";
import { ConnectionPill } from "@common/components/connection-pill";

interface KinkItem {
  id: number;
  icon: any;
  name: string;
  text: string;
  pattern?: number[];
}

const initialKinkData = [
  {
    id: 1,
    name: "Generate",
    text: "Generate your own fun",
    icon: AddIcon,
  },
  {
    id: 2,
    name: "HardCore",
    text: "High-energy and intense",
    icon: HardCore,
    pattern: [
      62, 32, 40, 41, 28, 56, 32, 89, 55, 95, 80, 9, 81, 59, 81, 35, 57, 8, 48,
      57, 77, 28, 75, 38, 73, 59, 15, 62, 88, 78,
    ],
  },
  {
    id: 3,
    name: "Gentle",
    text: "Soft and even",
    icon: Gentle,
    pattern: [
      64, 32, 0, 28, 23, 32, 2, 13, 70, 86, 82, 97, 33, 45, 73, 64, 11, 46, 18,
      28, 58, 71, 16, 88, 9, 14, 41, 3, 10, 20,
    ],
  },
  {
    id: 4,
    name: "Lazy",
    text: "Low-intensity and smooth",
    icon: Lazy,
    pattern: [
      23, 23, 7, 75, 46, 78, 22, 30, 24, 32, 86, 58, 16, 84, 12, 79, 96, 62, 11,
      54, 31, 66, 48, 77, 56, 61, 78, 25, 23, 18,
    ],
  },
  {
    id: 5,
    name: "Playful",
    text: "Fun and unexpected",
    icon: Playful,
    pattern: [
      30, 34, 89, 34, 51, 14, 8, 63, 62, 32, 98, 7, 33, 85, 61, 91, 34, 39, 70,
      19, 14, 38, 96, 67, 87, 58, 10, 58, 80, 82,
    ],
  },
  {
    id: 6,
    name: "Random",
    text: "Surprise!",
    icon: Random,
    pattern: [
      20, 30, 30, 62, 67, 81, 66, 75, 25, 11, 47, 60, 8, 4, 47, 60, 28, 35, 2,
      58, 57, 64, 67, 83, 38, 69, 52, 69, 67, 44,
    ],
  },
  {
    id: 7,
    name: "Dominant",
    text: "Sharp and fast",
    icon: Dominant,
    pattern: [
      23, 23, 7, 75, 46, 78, 22, 30, 24, 32, 86, 58, 16, 84, 12, 79, 96, 62, 11,
      54, 31, 66, 48, 77, 56, 61, 78, 25, 23, 18,
    ],
  },
  {
    id: 8,
    name: "Untitled",
    text: "",
    icon: Untitled,
    pattern: [
      62, 32, 40, 41, 28, 56, 32, 89, 55, 95, 80, 9, 81, 59, 81, 35, 57, 8, 48,
      57, 77, 28, 75, 38, 73, 59, 15, 62, 88, 78,
    ],
  },
];

interface KinkItem {
  id: number;
  icon: any;
  name: string;
  text: string;
}

const ChooseKinkScreen = () => {
  const navigation = useNavigation();
  const [selectedKink, setSelectedKink] = useState<number | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [kinkData, setKinkData] = useState(initialKinkData);
  const { showAlert, hideAlert } = useCustomAlert();

  const wiggleAnim = useRef(new Animated.Value(0)).current;

  const { isConnected } = useHomeScreen();

  const startWiggle = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopWiggle = () => {
    wiggleAnim.setValue(0); // Reset animation
  };

  useEffect(() => {
    if (deleteMode) {
      startWiggle();
    } else {
      stopWiggle();
    }
  }, [deleteMode]);

  // Function to enter delete mode on long press
  const handleLongPress = () => {
    setDeleteMode(true);
    // Vibration.vibrate([100, 200, 100, 200], true);
  };

  const handleDelete = (id: number) => {
    const newData = kinkData.filter((item) => item.id !== id);
    setKinkData(newData);
    // Vibration.cancel();
    setDeleteMode(false); // Exit delete mode after deletion
  };

  const handleDeleteKink = (id: number) => {
    showAlert({
      title: "Delete Kink",
      message: "Are you sure you want to delete this kink?",
      primaryButton: {
        text: "Delete",
        onPress: () => handleDelete(id),
      },
      secondaryButton: {
        text: "Cancel",
        onPress: hideAlert,
      },
      cancelable: true,
    });
  };

  const handlePatternPress = ({
    pattern,
    title,
  }: {
    pattern?: number[];
    title: string;
  }) =>
    navigation
      .getParent()
      ?.navigate(SCREENS.DISPLAY_PATTERN, { pattern, title });

  const renderItem = ({ item }: { item: KinkItem }) => {
    const isGenerate = item.name === "Generate";
    return (
      <TouchableOpacity
        style={[
          styles.card,
          selectedKink === item.id && styles.selectedCard,
          {
            transform: [
              {
                rotate: wiggleAnim.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ["-1deg", "1deg"],
                }),
              },
            ],
          },
        ]}
        onPress={() =>
          isGenerate
            ? navigation.navigate(SCREENS.KINK_EMOTIONSELECTION)
            : handlePatternPress({
                title: item.name,
                pattern: item.pattern,
              })
        }
        onLongPress={handleLongPress}
      >
        {/* Show minus icon in delete mode */}
        {deleteMode && !isGenerate && (
          <TouchableOpacity
            style={styles.deleteIcon}
            onPress={() => handleDeleteKink(item.id)}
          >
            <DeleteIcon width={20} height={20} />
          </TouchableOpacity>
        )}

        {isGenerate ? (
          <View style={styles.icon}>
            <item.icon width={40} height={40} />
          </View>
        ) : (
          <TouchableOpacity style={styles.icon}>
            <item.icon width={40} height={40} />
          </TouchableOpacity>
        )}

        <Text style={styles.kinkName}>{item.name}</Text>
        <Text style={styles.kinkText}>{item.text}</Text>

        {!isGenerate && (
          <TouchableOpacity
            style={styles.heartIcon}
            onPress={() =>
              isGenerate
                ? navigation.navigate(SCREENS.KINK_EMOTIONSELECTION)
                : setSelectedKink(item.id)
            }
          >
            {selectedKink === item.id ? (
              <HeartFull width={35} height={35} />
            ) : (
              <HeartOutline width={35} height={35} />
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderContent = () => (
    <FlatList
      data={kinkData}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
      numColumns={2}
      nestedScrollEnabled={false}
      contentContainerStyle={styles.flatListContainer}
    />
  );

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
        <Text style={styles.headerTitle}>Kink</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftfrom width={35} height={35} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.lightbulbIcon}
          onPress={() => navigation.navigate(SCREENS.KINK_INTRO)}
        >
          <LightBulb width={35} height={35} />
        </TouchableOpacity>
      </View>

      {/* Connected Status */}
      <ConnectionPill />

      <View style={styles.contentContainer}>{renderContent()}</View>
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
});

export default ChooseKinkScreen;
