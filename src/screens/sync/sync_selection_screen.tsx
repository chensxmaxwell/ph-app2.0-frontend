import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import ChevronLeftfrom from "@images/chevron-left-white.svg";
import LightBulb from "@images/lightbulb.svg";
import AntennaIcon from "@images/antenna.svg";
import SearchIcon from "@images/search.svg";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { ConnectionPill } from "@common/components/connection-pill";

const images = {
  avatar1: require("../../../assets/images/avatar.png"),
  avatar2: require("../../../assets/images/avatar.png"),
  avatar3: require("../../../assets/images/avatar.png"),
};

const users = [
  { id: "1", name: "Kevin", avatar: "avatar1" },
  { id: "2", name: "Kevin", avatar: "avatar2" },
  { id: "3", name: "Kevin", avatar: "avatar3" },
];

const SyncSelectionScreen = () => {
  const navigation = useNavigation();
  const [text, setText] = useState("");
  const searchRef = useRef<TextInput>(null);
  const filteredUsers = useMemo(() => {
    const query = text.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((user) => user.name.toLowerCase().includes(query));
  }, [text]);

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
        <Text style={styles.headerTitle}>Sync</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftfrom width={35} height={35} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.lightbulbIcon}
          onPress={() => navigation.navigate(SCREENS.SYNC_INTRODUCTION)}
        >
          <LightBulb width={35} height={35} />
        </TouchableOpacity>
      </View>

      <ConnectionPill />

      <View style={styles.searchBarContainer}>
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Search in your contacts"
          placeholderTextColor={colors.grayLighter}
          value={text}
          onChangeText={setText}
          maxLength={30}
        />
        <TouchableOpacity onPress={() => searchRef.current?.focus()} hitSlop={8}>
          <SearchIcon width={35} height={35} style={styles.searchIcon} />
        </TouchableOpacity>
      </View>

      {/* Recent List */}
      <Text style={styles.recentTitle}>Recent</Text>
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listItem}
            onPress={() =>
              navigation.navigate(
                SCREENS.SYNC_SCREEN as never,
                { name: item.name } as never
              )
            }
          >
            <Image source={images[item.avatar]} style={styles.avatar} />
            <Text style={styles.userName}>{item.name}</Text>
            <View style={styles.waveButton}>
              <AntennaIcon width={35} height={35}></AntennaIcon>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    justifyContent: "space-between",
  },
  // Header Styles
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
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.grayLight,
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 40,
    marginTop: 20,
    marginHorizontal: 32,
  },
  searchInput: {
    flex: 1,
    paddingLeft: 8,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
  },
  searchIcon: {
    marginRight: 0,
  },
  // Recent Styles
  recentTitle: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    marginTop: 30,
    marginBottom: 10,
    marginHorizontal: 32,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 32,
    backgroundColor: colors.grayLightest,
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    height: 90,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 50,
    marginRight: 10,
  },
  userName: {
    flex: 1,
    color: colors.white,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    lineHeight: 16,
    marginTop: -30,
    marginLeft: 10,
  },
  waveButton: {
    width: 60,
    height: 60,
    borderRadius: 50,
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SyncSelectionScreen;
