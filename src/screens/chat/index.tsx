import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from "@react-navigation/native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { openCreateCompanion } from "../avatar/open";
import { s } from "../avatar/scale";
import SearchIcon from "@images/message/search.svg";
import PlusIcon from "@images/message/plus.svg";
import PencilIcon from "@images/message/pencil.svg";
import PersonPlus from "@images/message/person-plus.svg";
import { DESTRUCTIVE_RED, Dialog } from "./dialog";
import { useChat } from "./store";
import { ChatThread } from "./types";
import { faceSourceForId } from "./faces";

const faceFor = (thread: ChatThread) => faceSourceForId(thread.id, thread.kind);

// Swipe a row left (WeChat layout): gray "mark unread", then red "delete
// friend". Delete always double-checks through the Dialog below. Maxwell named
// these 「消息未读」 / 「删除好友」; the labels stay English like the rest of the
// Message screen — swap the two strings here if he wants them in Chinese.
const SWIPE_LABELS = {
  unread: "Mark unread",
  deleteFriend: "Delete friend",
} as const;
const UNREAD_ACTION_GRAY = "#8e8e93";
const ACTION_WIDTH = s(80);
const ACTIONS_WIDTH = ACTION_WIDTH * 2;

export const Chat = () => {
  const navigation = useNavigation();
  const parent = navigation.getParent() as NavigationProp<ParamListBase>;
  const { threads, setUnread, deleteThread } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatThread | null>(null);
  const swipeRows = useRef(new Map<string, Swipeable>());
  const openRowId = useRef<string | null>(null);

  const rows = useMemo(() => {
    const visible = threads.filter((thread) => thread.request !== "refused");
    return [...visible].sort(
      (left, right) => Number(right.pinned) - Number(left.pinned)
    );
  }, [threads]);

  const openThread = (threadId: string) => {
    setMenuOpen(false);
    parent.navigate(SCREENS.CHAT_THREAD as never, { threadId } as never);
  };

  const openSearch = () => {
    setMenuOpen(false);
    parent.navigate(SCREENS.CHAT_SEARCH);
  };

  // Only one row shows its actions at a time, like WeChat.
  const closeOtherRows = (threadId: string) => {
    const open = openRowId.current;
    if (open && open !== threadId) {
      swipeRows.current.get(open)?.close();
    }
  };

  const markUnread = (thread: ChatThread, row: Swipeable) => {
    // Already unread stays unread; there is no separate "mark read" action,
    // opening the thread is what reads it.
    setUnread(thread.id, true);
    row.close();
  };

  const askDeleteFriend = (thread: ChatThread, row: Swipeable) => {
    row.close();
    setPendingDelete(thread);
  };

  const confirmDeleteFriend = () => {
    if (!pendingDelete) {
      return;
    }
    swipeRows.current.delete(pendingDelete.id);
    deleteThread(pendingDelete.id);
    setPendingDelete(null);
  };

  // `drag` is the row's translation (0 → -ACTIONS_WIDTH). Sliding the buttons
  // with it keeps them glued to the row's trailing edge, so the translucent
  // card never shows them through itself mid-swipe.
  const renderRowActions = (
    thread: ChatThread,
    drag: Animated.AnimatedInterpolation<number>,
    row: Swipeable
  ) => (
    <Animated.View
      style={[
        styles.rowActions,
        { transform: [{ translateX: Animated.add(drag, ACTIONS_WIDTH) }] },
      ]}
    >
      <TouchableOpacity
        testID={`message-row-unread-${thread.id}`}
        accessibilityRole="button"
        accessibilityLabel={SWIPE_LABELS.unread}
        style={[styles.rowAction, styles.rowActionUnread]}
        onPress={() => markUnread(thread, row)}
        activeOpacity={0.85}
      >
        <Text style={styles.rowActionText} numberOfLines={2}>
          {SWIPE_LABELS.unread}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`message-row-delete-${thread.id}`}
        accessibilityRole="button"
        accessibilityLabel={SWIPE_LABELS.deleteFriend}
        style={[styles.rowAction, styles.rowActionDelete]}
        onPress={() => askDeleteFriend(thread, row)}
        activeOpacity={0.85}
      >
        <Text style={styles.rowActionText} numberOfLines={2}>
          {SWIPE_LABELS.deleteFriend}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <ScreenWrapper withNavBar disableScrolling>
      <GestureHandlerRootView style={styles.root}>
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
            testID="message-add"
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
              testID="message-create-new"
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                openCreateCompanion(parent);
              }}
            >
              <Text style={styles.menuText}>Create new</Text>
              <PencilIcon width={s(25)} height={s(25)} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                parent.navigate(
                  SCREENS.CHAT_SEARCH as never,
                  {
                    addFriends: true,
                  } as never
                );
              }}
            >
              <Text style={styles.menuText}>Add friends</Text>
              <PersonPlus width={s(25)} height={s(25)} />
            </TouchableOpacity>
          </View>
        ) : null}
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {rows.length === 0 ? (
            <Text style={styles.empty} testID="message-empty">
              No friends yet. Tap + to create one or add friends.
            </Text>
          ) : null}
          {rows.map((thread) => (
            <Swipeable
              key={thread.id}
              ref={(row) => {
                if (row) {
                  swipeRows.current.set(thread.id, row);
                } else {
                  swipeRows.current.delete(thread.id);
                }
              }}
              containerStyle={styles.swipeRow}
              overshootRight={false}
              rightThreshold={s(56)}
              onSwipeableOpenStartDrag={() => closeOtherRows(thread.id)}
              onSwipeableWillOpen={() => {
                closeOtherRows(thread.id);
                openRowId.current = thread.id;
              }}
              onSwipeableWillClose={() => {
                if (openRowId.current === thread.id) {
                  openRowId.current = null;
                }
              }}
              renderRightActions={(_progress, drag, row) =>
                renderRowActions(thread, drag, row)
              }
            >
              <TouchableOpacity
                testID={`message-row-${thread.id}`}
                style={styles.row}
                onPress={() => openThread(thread.id)}
                activeOpacity={0.85}
              >
                <View style={styles.rowFaceWrap}>
                  <Image source={faceFor(thread)} style={styles.rowFace} />
                  {thread.unread ? (
                    <View
                      testID={`message-row-unread-dot-${thread.id}`}
                      style={styles.unreadDot}
                    />
                  ) : null}
                </View>
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
            </Swipeable>
          ))}
        </ScrollView>
        {pendingDelete ? (
          <Dialog
            testID="message-delete-confirm"
            title={`Delete ${pendingDelete.name}?`}
            body={`${pendingDelete.name} and this chat will be removed from Message.`}
            primary={SWIPE_LABELS.deleteFriend}
            secondary="Cancel"
            destructive
            onPrimary={confirmDeleteFriend}
            onSecondary={() => setPendingDelete(null)}
          />
        ) : null}
      </GestureHandlerRootView>
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
  list: {
    flex: 1,
    marginTop: s(20),
    marginBottom: s(90),
  },
  listContent: {
    gap: s(12),
    paddingBottom: s(24),
  },
  empty: {
    marginTop: s(24),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  swipeRow: {
    borderRadius: s(16),
    overflow: "hidden",
  },
  rowActions: {
    width: ACTIONS_WIDTH,
    flexDirection: "row",
  },
  rowAction: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(6),
  },
  rowActionUnread: {
    backgroundColor: UNREAD_ACTION_GRAY,
  },
  rowActionDelete: {
    backgroundColor: DESTRUCTIVE_RED,
  },
  rowActionText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  row: {
    minHeight: s(76),
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(12),
  },
  rowFaceWrap: {
    width: s(52),
    height: s(52),
  },
  rowFace: {
    width: s(52),
    height: s(52),
    borderRadius: s(26),
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    backgroundColor: DESTRUCTIVE_RED,
  },
  rowCopy: {
    flex: 1,
    marginLeft: s(12),
    minWidth: 0,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: s(8),
  },
  rowName: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
    flex: 1,
  },
  rowTime: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 12,
  },
  rowPreview: {
    marginTop: s(6),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Medium",
    fontSize: 14,
  },
});

export default Chat;
