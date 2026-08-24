import React, { useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import ChevronBack from "@images/avatar/chevron-back.svg";
import Lightbulb from "@images/lightbulb.svg";
import Waveform from "@images/love/waveform.svg";
import PlusCircle from "@images/love/plus-circle.svg";
import Paperplane from "@images/love/paperplane.svg";
import KeyboardIcon from "@images/message/keyboard.svg";
import ListenIcon from "@images/message/listen.svg";
import PhoneIcon from "@images/message/phone.svg";
import PinIcon from "@images/message/pin.svg";
import LinkIcon from "@images/message/link.svg";
import Heartbeat from "@images/message/heartbeat.svg";
import { s } from "../avatar/scale";
import { ChatGradient } from "./background";
import { useChat } from "./store";
import { ChatBubble, ChatThread } from "./types";

const FACE = require("../../../assets/images/message/kevin.png");
const PHOTO = require("../../../assets/images/message/kevin-photo.png");

type ThreadRoute = RouteProp<{ ChatThread: { threadId: string } }, "ChatThread">;

const faceFor = (thread: ChatThread) =>
  thread.kind === "human" ? PHOTO : FACE;

const Dialog = ({
  title,
  body,
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: {
  title: string;
  body: string;
  primary: string;
  secondary: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) => (
  <View style={styles.dialogScrim}>
    <View style={styles.dialog}>
      <Text style={styles.dialogTitle}>{title}</Text>
      <Text style={styles.dialogBody}>{body}</Text>
      <TouchableOpacity style={styles.dialogPrimary} onPress={onPrimary}>
        <Text style={styles.dialogPrimaryText}>{primary}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSecondary}>
        <Text style={styles.dialogSecondary}>{secondary}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export const ChatThreadScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute<ThreadRoute>();
  const {
    getThread,
    sendText,
    sendVoice,
    editLastMine,
    regenerate,
    setListen,
    setPinned,
    setSynced,
    speakMessage,
    speakingId,
    inCallThreadId,
    setInCall,
    setRequest,
    humanLimitReached,
  } = useChat();
  const thread = getThread(route.params.threadId);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPage, setDrawerPage] = useState(0);
  const [talkMode, setTalkMode] = useState(false);
  const [holding, setHolding] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [listenBlocked, setListenBlocked] = useState(false);
  const listRef = useRef<ScrollView>(null);

  if (!thread) {
    return (
      <ChatGradient>
        <SafeAreaView style={styles.safe}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronBack width={s(35)} height={s(35)} />
          </TouchableOpacity>
        </SafeAreaView>
      </ChatGradient>
    );
  }

  const typing = draft.trim().length > 0;
  const limited = humanLimitReached(thread);
  const showHero =
    thread.request === "incoming" ||
    thread.request === "sent" ||
    limited ||
    thread.messages.length <= 1;
  const lastThem = [...thread.messages]
    .reverse()
    .find((item) => item.from === "them");
  const lastMine = [...thread.messages]
    .reverse()
    .find((item) => item.from === "me" && !item.voice);

  const goBack = () => {
    if (thread.synced || inCallThreadId === thread.id) {
      setLeaveOpen(true);
      return;
    }
    navigation.goBack();
  };

  const submit = () => {
    if (!draft.trim()) {
      return;
    }
    if (editingId) {
      editLastMine(thread.id, draft);
      setEditingId(null);
    } else {
      sendText(thread.id, draft);
    }
    setDraft("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const openListen = () => {
    if (inCallThreadId) {
      setListenBlocked(true);
      return;
    }
    setListen(thread.id, !thread.listen);
  };

  const renderBubble = (item: ChatBubble) => {
    const isMe = item.from === "me";
    return (
      <Pressable
        key={item.id}
        onLongPress={() => {
          if (isMe && lastMine?.id === item.id) {
            setDraft(item.text);
            setEditingId(item.id);
            setTalkMode(false);
            setDrawerOpen(false);
          }
        }}
        style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}
      >
        {item.voice && isMe ? (
          <ListenIcon width={s(35)} height={s(35)} />
        ) : null}
        <View
          style={[
            styles.bubble,
            item.synced ? styles.bubbleSynced : null,
          ]}
        >
          <Text style={styles.bubbleText}>{item.text}</Text>
          {item.edited ? <Text style={styles.edited}>Edited</Text> : null}
        </View>
        {!isMe && thread.listen ? (
          <TouchableOpacity
            onPress={() => speakMessage(thread.id, item)}
            style={speakingId === item.id ? styles.listenHitOn : styles.listenHit}
          >
            <ListenIcon width={s(35)} height={s(35)} />
          </TouchableOpacity>
        ) : null}
      </Pressable>
    );
  };

  return (
    <ChatGradient>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} hitSlop={8} style={styles.headerSide}>
            <ChevronBack width={s(35)} height={s(35)} />
          </TouchableOpacity>
          <View style={styles.identity}>
            <Image source={faceFor(thread)} style={styles.headerFace} />
            <Text style={styles.headerName}>{thread.name}</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate(
                SCREENS.CHAT_SETTINGS as never,
                { threadId: thread.id } as never
              )
            }
            style={styles.headerSide}
          >
            <Lightbulb width={s(35)} height={s(35)} />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={listRef}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
          >
            {showHero ? (
              <View style={styles.hero}>
                <Image source={faceFor(thread)} style={styles.heroFace} />
                <Text style={styles.heroName}>{thread.name}</Text>
                {thread.email ? (
                  <Text style={styles.heroSub}>{thread.email}</Text>
                ) : (
                  <Text style={styles.heroSub}>
                    {`Start chatting with ${thread.name}.`}
                  </Text>
                )}
                {thread.request === "incoming" ? (
                  <View style={styles.requestBubble}>
                    <Text style={styles.bubbleText}>
                      {`${thread.name} wants to chat with you`}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {thread.messages.map(renderBubble)}
            {thread.synced ? (
              <Text style={styles.syncLine}>
                {`You are now syncing with ${thread.name}`}
              </Text>
            ) : null}
            {lastThem && !typing && thread.kind === "bot" && !talkMode ? (
              <TouchableOpacity
                onPress={() => regenerate(thread.id)}
                style={styles.regen}
              >
                <Text style={styles.regenText}>Regenerate</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          {thread.request === "incoming" ? (
            <View style={[styles.gate, { paddingBottom: insets.bottom + s(16) }]}>
              <TouchableOpacity
                style={styles.primary}
                onPress={() => setRequest(thread.id, "accepted")}
              >
                <Text style={styles.primaryText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.link}>Refuse</Text>
              </TouchableOpacity>
            </View>
          ) : thread.request === "sent" ? (
            <View style={[styles.gate, { paddingBottom: insets.bottom + s(16) }]}>
              <TouchableOpacity
                style={styles.primary}
                onPress={() => setRequest(thread.id, "sent")}
              >
                <Text style={styles.primaryText}>Resend request</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.link}>Cancel request</Text>
              </TouchableOpacity>
            </View>
          ) : limited ? (
            <View style={[styles.gate, { paddingBottom: insets.bottom + s(16) }]}>
              <Text style={styles.limit}>
                You have reached your free message limit
              </Text>
              <TouchableOpacity
                style={styles.primary}
                onPress={() => navigation.navigate(SCREENS.PREMIUM)}
              >
                <Text style={styles.primaryText}>Go Premium</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.link}>Return</Text>
              </TouchableOpacity>
            </View>
          ) : talkMode ? (
            <View
              style={[
                styles.talkBar,
                { paddingBottom: insets.bottom, height: s(80) + insets.bottom },
              ]}
            >
              <TouchableOpacity onPress={() => setTalkMode(false)}>
                <KeyboardIcon width={s(35)} height={s(35)} />
              </TouchableOpacity>
              <Pressable
                onPressIn={() => setHolding(true)}
                onPressOut={() => {
                  setHolding(false);
                  sendVoice(thread.id);
                }}
                style={[styles.talkButton, holding && styles.talkButtonHot]}
              >
                <Text style={styles.talkText}>
                  {holding ? "Release to send" : "Press to start talking"}
                </Text>
              </Pressable>
              <TouchableOpacity
                onPress={() => {
                  setTalkMode(false);
                  setDrawerOpen(true);
                }}
              >
                <PlusCircle width={s(35)} height={s(35)} />
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.composer,
                {
                  paddingBottom: insets.bottom,
                  height: s(80) + insets.bottom,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  setDrawerOpen(false);
                  setTalkMode(true);
                }}
              >
                <Waveform width={s(35)} height={s(35)} />
              </TouchableOpacity>
              <View style={styles.inputWrap}>
                <TextInput
                  value={draft}
                  onChangeText={(value) => {
                    setDraft(value);
                    setDrawerOpen(false);
                  }}
                  style={styles.input}
                  placeholder="Type your message here.."
                  placeholderTextColor={colors.grayLighter}
                  multiline
                  onFocus={() => setDrawerOpen(false)}
                />
              </View>
              <TouchableOpacity
                onPress={() => {
                  setTalkMode(false);
                  setDrawerOpen((open) => !open);
                }}
              >
                <PlusCircle width={s(35)} height={s(35)} />
              </TouchableOpacity>
              <TouchableOpacity onPress={submit} style={styles.send}>
                <Paperplane width={s(35)} height={s(35)} />
              </TouchableOpacity>
            </View>
          )}

          {drawerOpen && !talkMode && thread.request === "none" && !limited ? (
            <View style={[styles.drawer, { paddingBottom: insets.bottom }]}>
              <View style={styles.drawerRow}>
                {(drawerPage === 0
                  ? [
                      {
                        key: "sync",
                        label: "Sync",
                        Icon: LinkIcon,
                        onPress: () => {
                          setSynced(thread.id, true);
                          navigation.navigate(SCREENS.SYNC_STACK as never);
                        },
                      },
                      {
                        key: "call",
                        label: "Call",
                        Icon: PhoneIcon,
                        onPress: () =>
                          navigation.navigate(
                            SCREENS.CHAT_CALL as never,
                            { threadId: thread.id } as never
                          ),
                      },
                      {
                        key: "pin",
                        label: thread.pinned ? "Unpin chat" : "Pin chat",
                        Icon: PinIcon,
                        onPress: () => setPinned(thread.id, !thread.pinned),
                        active: thread.pinned,
                      },
                      {
                        key: "listen",
                        label: "Listen",
                        Icon: ListenIcon,
                        onPress: openListen,
                        active: thread.listen,
                      },
                    ]
                  : [
                      {
                        key: "bliss",
                        label: "Bliss",
                        Icon: Heartbeat,
                        onPress: () =>
                          navigation.navigate(SCREENS.BLISS_STACK as never),
                      },
                    ]
                ).map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.drawerItem}
                    onPress={item.onPress}
                  >
                    <View
                      style={[
                        styles.drawerTile,
                        item.active ? styles.drawerTileOn : null,
                      ]}
                    >
                      <item.Icon width={s(35)} height={s(35)} />
                    </View>
                    <Text style={styles.drawerLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.dots}>
                {[0, 1].map((page) => (
                  <Pressable
                    key={page}
                    onPress={() => setDrawerPage(page)}
                    style={[
                      styles.dot,
                      drawerPage === page ? styles.dotOn : null,
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
      {leaveOpen ? (
        <Dialog
          title="Actions in progress"
          body="Leaving this chat will end voice calling and syncing session."
          primary="Leave"
          secondary="Cancel"
          onPrimary={() => {
            setSynced(thread.id, false);
            setInCall(null);
            setLeaveOpen(false);
            navigation.goBack();
          }}
          onSecondary={() => setLeaveOpen(false)}
        />
      ) : null}
      {listenBlocked ? (
        <Dialog
          title="Voice Call in Progress"
          body="You cannot listen to voice messages when voice calling someone."
          primary="Confirm"
          secondary="Return"
          onPrimary={() => setListenBlocked(false)}
          onSecondary={() => setListenBlocked(false)}
        />
      ) : null}
    </ChatGradient>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: s(50),
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
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(16),
  },
  headerFace: {
    width: s(50),
    height: s(50),
    borderRadius: s(25),
  },
  headerName: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
  },
  messages: {
    paddingHorizontal: s(24),
    paddingTop: s(24),
    paddingBottom: s(16),
    gap: s(16),
  },
  hero: {
    alignItems: "center",
    paddingBottom: s(16),
  },
  heroFace: {
    width: s(120),
    height: s(120),
    borderRadius: s(60),
  },
  heroName: {
    marginTop: s(16),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 24,
  },
  heroSub: {
    marginTop: s(8),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  requestBubble: {
    marginTop: s(24),
    backgroundColor: colors.grayLightest,
    borderRadius: s(20),
    padding: s(16),
  },
  bubbleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  bubbleWrapMe: {
    alignSelf: "flex-end",
  },
  bubble: {
    maxWidth: s(253),
    backgroundColor: colors.grayLightest,
    borderRadius: s(20),
    padding: s(16),
  },
  bubbleSynced: {
    backgroundColor: "rgba(204, 160, 221, 0.3)",
  },
  bubbleText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  edited: {
    marginTop: s(6),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 10,
  },
  listenHit: {
    opacity: 0.85,
  },
  listenHitOn: {
    opacity: 1,
  },
  syncLine: {
    alignSelf: "center",
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  regen: {
    alignSelf: "flex-start",
  },
  regenText: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  composer: {
    backgroundColor: "#4c495f",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: s(8),
    paddingHorizontal: s(16),
  },
  inputWrap: {
    width: s(216),
    minHeight: s(48),
    marginLeft: s(16),
    marginRight: s(8),
    borderRadius: s(12),
    backgroundColor: colors.grayLightest,
    justifyContent: "center",
    paddingHorizontal: s(16),
    paddingVertical: s(8),
  },
  input: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    padding: 0,
  },
  send: {
    marginLeft: s(8),
  },
  talkBar: {
    backgroundColor: "#4c495f",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: s(8),
    paddingHorizontal: s(16),
    gap: s(12),
  },
  talkButton: {
    flex: 1,
    height: s(48),
    borderRadius: s(24),
    backgroundColor: colors.grayLightSolid,
    alignItems: "center",
    justifyContent: "center",
  },
  talkButtonHot: {
    opacity: 0.7,
  },
  talkText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  drawer: {
    backgroundColor: "#2f2d3c",
    paddingTop: s(24),
    paddingHorizontal: s(24),
  },
  drawerRow: {
    flexDirection: "row",
    gap: s(16),
  },
  drawerItem: {
    width: s(75),
    alignItems: "center",
  },
  drawerTile: {
    width: s(75),
    height: s(75),
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerTileOn: {
    borderWidth: 1,
    borderColor: colors.white,
  },
  drawerLabel: {
    marginTop: s(8),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  dots: {
    marginTop: s(16),
    flexDirection: "row",
    justifyContent: "center",
    gap: s(8),
  },
  dot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
    backgroundColor: colors.grayLighter,
  },
  dotOn: {
    backgroundColor: colors.white,
  },
  gate: {
    paddingHorizontal: s(40),
    alignItems: "center",
    gap: s(16),
  },
  limit: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  primary: {
    width: "100%",
    height: s(50),
    borderRadius: s(25),
    backgroundColor: colors.grayLightSolid,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  link: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  dialogScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(40),
  },
  dialog: {
    width: "100%",
    borderRadius: s(20),
    backgroundColor: "#3b3850",
    padding: s(24),
    alignItems: "center",
    gap: s(12),
  },
  dialogTitle: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  dialogBody: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  dialogPrimary: {
    marginTop: s(8),
    width: "100%",
    height: s(50),
    borderRadius: s(25),
    backgroundColor: colors.grayLightSolid,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogPrimaryText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  dialogSecondary: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
});
