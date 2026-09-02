import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
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
import { useOpenLove } from "../love/pill";
import { ChatGradient } from "./background";
import { Dialog } from "./dialog";
import { useChat } from "./store";
import { formatChatThreadTime, showsTimeSeparator } from "./time";
import { ChatBubble, ChatThread } from "./types";
import { faceSourceForId } from "./faces";
import { useNow } from "./use-now";
import { enterTalkMode, leaveTalkMode } from "./talk-mode";
import { sanitizeComposerText } from "../../services/dictation-text";
import { startVoiceInput, stopVoiceInput } from "../../services/voice-input";
import { clearComposerAfterSubmit } from "../../services/composer-submit";

type ThreadRoute = RouteProp<{ ChatThread: { threadId: string } }, "ChatThread">;

const faceFor = (thread: ChatThread) =>
  faceSourceForId(thread.id, thread.kind);

export const ChatThreadScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute<ThreadRoute>();
  const {
    getThread,
    sendText,
    editLastMine,
    regenerate,
    setListen,
    setPinned,
    setSynced,
    setUnread,
    speakMessage,
    speakingId,
    inCallThreadId,
    setInCall,
    setRequest,
    cancelFriendRequest,
    humanLimitReached,
    chatNotice,
  } = useChat();
  const thread = getThread(route.params.threadId);
  const openLove = useOpenLove();
  // Ticks so a fresh separator's "now" ages to "3 min ago" in place.
  const now = useNow();
  const threadId = thread?.id;
  const threadUnread = !!thread?.unread;

  // Opening a thread reads it, whichever screen navigated here (Message list,
  // Home avatar strip, search, contact).
  useEffect(() => {
    if (threadId && threadUnread) {
      setUnread(threadId, false);
    }
  }, [setUnread, threadId, threadUnread]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPage, setDrawerPage] = useState(0);
  const [talkMode, setTalkMode] = useState(false);
  const [holding, setHolding] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [listenBlocked, setListenBlocked] = useState(false);
  const [resentNote, setResentNote] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const listRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const submittedDraftClearRef = useRef<(() => void) | null>(null);

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
  const chatting =
    (thread.request === "none" || thread.request === "accepted") && !limited;
  const showHero =
    thread.request === "incoming" ||
    thread.request === "sent" ||
    limited ||
    thread.messages.length === 0;
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

  const finishSubmittedDraftClear = () => {
    const clear = submittedDraftClearRef.current;
    submittedDraftClearRef.current = null;
    clear?.();
  };

  const clearSubmittedDraft = () => {
    clearComposerAfterSubmit({
      endEditingBeforeClear: Platform.OS === "ios",
      input: inputRef.current,
      dismissKeyboard: Keyboard.dismiss,
      clearDraft: () => setDraft(""),
      deferClearUntilBlur: (clear) => {
        submittedDraftClearRef.current = clear;
      },
    });
  };

  const submit = () => {
    const text = sanitizeComposerText(draft);
    if (!text.trim()) {
      return;
    }
    clearSubmittedDraft();
    if (editingId) {
      editLastMine(thread.id, text);
      setEditingId(null);
    } else {
      sendText(thread.id, text);
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const openListen = () => {
    if (inCallThreadId) {
      setListenBlocked(true);
      return;
    }
    setListen(thread.id, !thread.listen);
  };

  // WeChat puts a time line above a bubble (first one, then after every gap of
  // five minutes or more) rather than a time on each bubble.
  const renderBubble = (item: ChatBubble, index: number) => {
    const isMe = item.from === "me";
    const separator = showsTimeSeparator(thread.messages[index - 1], item)
      ? formatChatThreadTime(item.sentAt, now)
      : null;
    return (
      <React.Fragment key={item.id}>
        {separator ? (
          <Text testID={`message-time-${item.id}`} style={styles.timeLine}>
            {separator}
          </Text>
        ) : null}
        <Pressable
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
              style={
                speakingId === item.id ? styles.listenHitOn : styles.listenHit
              }
            >
              <ListenIcon width={s(35)} height={s(35)} />
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </React.Fragment>
    );
  };

  return (
    <ChatGradient>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Pressable
          style={styles.header}
          onPress={drawerOpen ? () => setDrawerOpen(false) : undefined}
        >
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
        </Pressable>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.flex}>
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
            {chatNotice(thread.id) ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{chatNotice(thread.id)}</Text>
              </View>
            ) : null}
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
          {drawerOpen ? (
            <Pressable
              style={styles.drawerScrim}
              onPress={() => setDrawerOpen(false)}
            />
          ) : null}
          </View>

          {thread.request === "incoming" ? (
            <View style={[styles.gate, { paddingBottom: insets.bottom + s(16) }]}>
              <TouchableOpacity
                style={styles.primary}
                onPress={() => setRequest(thread.id, "accepted")}
              >
                <Text style={styles.primaryText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setRequest(thread.id, "refused");
                  navigation.goBack();
                }}
              >
                <Text style={styles.link}>Refuse</Text>
              </TouchableOpacity>
            </View>
          ) : thread.request === "sent" ? (
            <View style={[styles.gate, { paddingBottom: insets.bottom + s(16) }]}>
              {resentNote ? (
                <Text style={styles.limit}>Request resent</Text>
              ) : null}
              <TouchableOpacity
                style={styles.primary}
                onPress={() => {
                  setRequest(thread.id, "sent");
                  setResentNote(true);
                }}
              >
                <Text style={styles.primaryText}>Resend request</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  cancelFriendRequest(thread.id);
                  navigation.goBack();
                }}
              >
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
          ) : (
            <>
            <View
              pointerEvents={talkMode ? "none" : "auto"}
              style={
                talkMode
                  ? styles.composerHidden
                  : [
                      styles.composer,
                      {
                        paddingBottom: insets.bottom,
                        minHeight: s(80) + insets.bottom,
                      },
                    ]
              }
            >
              <TouchableOpacity
                onPress={() => {
                  setVoiceError(null);
                  enterTalkMode({
                    dismissKeyboard: () => Keyboard.dismiss(),
                    blurInput: () => inputRef.current?.blur(),
                    setDrawerOpen,
                    setTalkMode,
                  });
                }}
                style={styles.iconHit}
                hitSlop={8}
              >
                <Waveform width={s(35)} height={s(35)} />
              </TouchableOpacity>
              <View style={styles.inputWrap}>
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={(value) => {
                    // Do not rewrite marked text while iOS dictation or an IME owns it.
                    setDraft(value);
                    setDrawerOpen(false);
                  }}
                  style={styles.input}
                  placeholder="Type your message here.."
                  placeholderTextColor={colors.grayLighter}
                  multiline
                  onFocus={() => setDrawerOpen(false)}
                  onBlur={finishSubmittedDraftClear}
                />
              </View>
              <TouchableOpacity
                onPress={() => {
                  setTalkMode(false);
                  setDrawerOpen((open) => !open);
                }}
                style={styles.plus}
                hitSlop={12}
              >
                <PlusCircle width={s(35)} height={s(35)} />
              </TouchableOpacity>
              <TouchableOpacity onPress={submit} style={styles.send} hitSlop={8}>
                <Paperplane width={s(35)} height={s(35)} />
              </TouchableOpacity>
            </View>
            {talkMode ? (
              <View
                style={[
                  styles.talkBar,
                  { paddingBottom: insets.bottom, height: s(80) + insets.bottom },
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    stopVoiceInput().catch(() => undefined);
                    leaveTalkMode({ setTalkMode, setHolding });
                    setVoiceError(null);
                  }}
                  style={styles.iconHit}
                  hitSlop={8}
                >
                  <KeyboardIcon width={s(35)} height={s(35)} />
                </TouchableOpacity>
                <Pressable
                  onPressIn={() => {
                    setHolding(true);
                    setVoiceError(null);
                    startVoiceInput().then((result) => {
                      if (!result.ok) {
                        setHolding(false);
                        setVoiceError(result.message);
                      }
                    });
                  }}
                  onPressOut={() => {
                    setHolding(false);
                    stopVoiceInput().then((result) => {
                      if (result.ok && result.text.trim()) {
                        sendText(thread.id, result.text);
                        setVoiceError(null);
                        return;
                      }
                      if (!result.ok) {
                        setVoiceError(result.message);
                      }
                    });
                  }}
                  style={[styles.talkButton, holding && styles.talkButtonHot]}
                >
                  <Text style={styles.talkText}>
                    {holding ? "Release to send" : "Press to start talking"}
                  </Text>
                </Pressable>
                <TouchableOpacity
                  onPress={() => {
                    stopVoiceInput().catch(() => undefined);
                    leaveTalkMode({ setTalkMode, setHolding });
                    setDrawerOpen(true);
                  }}
                  style={styles.plus}
                  hitSlop={12}
                >
                  <PlusCircle width={s(35)} height={s(35)} />
                </TouchableOpacity>
              </View>
            ) : null}
            {voiceError && talkMode ? (
              <Text style={styles.voiceError}>{voiceError}</Text>
            ) : null}
            </>
          )}

          {drawerOpen && !talkMode && chatting ? (
            <View style={[styles.drawer, { paddingBottom: insets.bottom }]}>
              <View style={styles.drawerRow}>
                {(drawerPage === 0
                  ? [
                      {
                        key: "sync",
                        label: "Sync",
                        Icon: LinkIcon,
                        onPress: () => {
                          setDrawerOpen(false);
                          setSynced(thread.id, true);
                          openLove({
                            companionId: thread.id,
                            name: thread.name,
                            syncing: true,
                            fromMessage: true,
                          });
                        },
                      },
                      {
                        key: "call",
                        label: "Call",
                        Icon: PhoneIcon,
                        onPress: () => {
                          setDrawerOpen(false);
                          navigation.navigate(
                            SCREENS.CHAT_CALL as never,
                            { threadId: thread.id } as never
                          );
                        },
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
                        onPress: () => {
                          setDrawerOpen(false);
                          navigation.navigate(SCREENS.BLISS_STACK as never);
                        },
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
                    hitSlop={8}
                    style={styles.dotHit}
                  >
                    <View
                      style={[
                        styles.dot,
                        drawerPage === page ? styles.dotOn : null,
                      ]}
                    />
                  </Pressable>
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
  notice: {
    alignSelf: "center",
    maxWidth: s(280),
    marginTop: s(8),
    paddingHorizontal: s(16),
    paddingVertical: s(12),
    borderRadius: s(16),
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  noticeText: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  syncLine: {
    alignSelf: "center",
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  timeLine: {
    alignSelf: "center",
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 11,
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
    alignItems: "center",
    paddingTop: s(8),
    paddingHorizontal: s(12),
    gap: s(8),
    zIndex: 5,
  },
  composerHidden: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  voiceError: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: s(16),
    paddingBottom: s(8),
    backgroundColor: "#4c495f",
  },
  inputWrap: {
    flex: 1,
    minHeight: s(48),
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
  iconHit: {
    width: s(44),
    height: s(44),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  plus: {
    width: s(44),
    height: s(44),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  send: {
    width: s(44),
    height: s(44),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  talkBar: {
    backgroundColor: "#4c495f",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: s(8),
    paddingHorizontal: s(12),
    gap: s(12),
    zIndex: 5,
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
  drawerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 3,
  },
  drawer: {
    backgroundColor: "#2f2d3c",
    paddingTop: s(24),
    paddingHorizontal: s(24),
    zIndex: 5,
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
  dotHit: {
    width: s(44),
    height: s(44),
    alignItems: "center",
    justifyContent: "center",
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
});
