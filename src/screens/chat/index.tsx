import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from "@react-navigation/native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { s } from "../avatar/scale";
import SearchIcon from "@images/message/search.svg";
import PlusIcon from "@images/message/plus.svg";
import PencilIcon from "@images/message/pencil.svg";
import PersonPlus from "@images/message/person-plus.svg";
import { useChat } from "./store";
import { ChatThread } from "./types";
import { faceSourceForId } from "./faces";

const faceFor = (thread: ChatThread) =>
  faceSourceForId(thread.id, thread.kind);

export const Chat = () => {
  const navigation = useNavigation();
  const parent = navigation.getParent() as NavigationProp<ParamListBase>;
  const { threads } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);

  const pinned = useMemo(
    () => threads.filter((thread) => thread.pinned),
    [threads]
  );
  const recent = threads.filter((thread) => thread.request !== "refused");

  const openThread = (threadId: string) => {
    setMenuOpen(false);
    parent.navigate(SCREENS.CHAT_THREAD as never, { threadId } as never);
  };

  const openSearch = () => {
    setMenuOpen(false);
    parent.navigate(SCREENS.CHAT_SEARCH);
  };

  return (
    <ScreenWrapper withNavBar disableScrolling>
      <View style={styles.root}>
        <Text style={styles.title}>Message</Text>
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={openSearch}
            activeOpacity={0.85}
          >
            <Text style={styles.searchPlaceholder}>
              Search for existing contact
            </Text>
            <SearchIcon width={s(33)} height={s(35)} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMenuOpen((open) => !open)}
            activeOpacity={0.85}
            hitSlop={12}
            style={styles.addHit}
          >
            <PlusIcon width={s(40)} height={s(40)} />
          </TouchableOpacity>
        </View>
        {menuOpen ? (
          <Pressable
            style={styles.menuScrim}
            onPress={() => setMenuOpen(false)}
          />
        ) : null}
        {menuOpen ? (
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                parent.navigate(SCREENS.CHAT_CREATE);
              }}
            >
              <Text style={styles.menuText}>Create new</Text>
              <PencilIcon width={s(25)} height={s(25)} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                parent.navigate(SCREENS.CHAT_SEARCH as never, {
                  addFriends: true,
                } as never);
              }}
            >
              <Text style={styles.menuText}>Add friends</Text>
              <PersonPlus width={s(25)} height={s(25)} />
            </TouchableOpacity>
          </View>
        ) : null}
        {pinned.length ? (
          <>
            <Text style={styles.section}>Pinned</Text>
            <View style={styles.pinnedCard}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pinnedRow}
              >
                {pinned.map((thread) => (
                  <TouchableOpacity
                    key={`pin-${thread.id}`}
                    onPress={() => openThread(thread.id)}
                  >
                    <Image source={faceFor(thread)} style={styles.pinFace} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        ) : null}
        <Text style={[styles.section, styles.recentLabel]}>Recent</Text>
        <ScrollView
          style={styles.recent}
          contentContainerStyle={styles.recentContent}
          showsVerticalScrollIndicator={false}
        >
          {recent.map((thread) => (
            <TouchableOpacity
              key={thread.id}
              style={styles.row}
              onPress={() => openThread(thread.id)}
              activeOpacity={0.85}
            >
              <Image source={faceFor(thread)} style={styles.rowFace} />
              <View style={styles.rowCopy}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {thread.request === "incoming"
                      ? "Friend request"
                      : thread.name}
                  </Text>
                  <Text style={styles.rowTime}>{thread.time}</Text>
                </View>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {thread.preview}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: s(24),
  },
  title: {
    marginTop: s(16),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 24,
  },
  searchRow: {
    marginTop: s(24),
    flexDirection: "row",
    alignItems: "center",
    gap: s(16),
  },
  searchBar: {
    flex: 1,
    height: s(40),
    borderRadius: s(20),
    backgroundColor: colors.grayLight,
    paddingLeft: s(16),
    paddingRight: s(8),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchPlaceholder: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    flex: 1,
  },
  addButton: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: colors.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  addHit: {
    width: s(44),
    height: s(44),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 3,
  },
  menu: {
    position: "absolute",
    top: s(118),
    right: s(24),
    width: s(168),
    borderRadius: s(16),
    backgroundColor: "rgba(76, 73, 95, 0.96)",
    paddingVertical: s(8),
    zIndex: 4,
  },
  menuItem: {
    height: s(40),
    paddingHorizontal: s(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  section: {
    marginTop: s(24),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
  },
  pinnedCard: {
    marginTop: s(16),
    height: s(100),
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    justifyContent: "center",
  },
  pinnedRow: {
    paddingHorizontal: s(9),
    gap: s(16),
    alignItems: "center",
  },
  pinFace: {
    width: s(70),
    height: s(70),
    borderRadius: s(35),
  },
  recentLabel: {
    marginTop: s(24),
  },
  recent: {
    flex: 1,
    marginTop: s(16),
    marginBottom: s(90),
  },
  recentContent: {
    gap: s(16),
    paddingBottom: s(24),
  },
  row: {
    height: s(90),
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(15),
  },
  rowFace: {
    width: s(60),
    height: s(60),
    borderRadius: s(30),
  },
  rowCopy: {
    flex: 1,
    marginLeft: s(18),
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowName: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    flex: 1,
    marginRight: s(8),
  },
  rowTime: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  rowPreview: {
    marginTop: s(8),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});

export default Chat;
