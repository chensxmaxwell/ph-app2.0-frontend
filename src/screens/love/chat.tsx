import React, { useEffect, useRef, useState } from "react";
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
import LinearGradient from "react-native-linear-gradient";
import { BlurView } from "@react-native-community/blur";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  NavigationProp,
  ParamListBase,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import ChevronBack from "@images/avatar/chevron-back.svg";
import Dots from "@images/love/dots.svg";
import Waveform from "@images/love/waveform.svg";
import PlusCircle from "@images/love/plus-circle.svg";
import Paperplane from "@images/love/paperplane.svg";
import ListenIcon from "@images/message/listen.svg";
import PhoneIcon from "@images/message/phone.svg";
import PinIcon from "@images/message/pin.svg";
import LinkIcon from "@images/message/link.svg";
import Heartbeat from "@images/message/heartbeat.svg";
import PatternIcon from "@images/icons/pattern-icon.svg";
import KinkIcon from "@images/icons/kink-icon.svg";
import { useCompanions } from "../../store/companions";
import { s } from "../avatar/scale";
import { LovePill } from "./pill";
import { dismissLoveOverlays } from "./overlay";
import { companionChatOrFallback } from "../../services/llm";
import { useLoveSession } from "./session";
import { LoveChatItem, LoveMode } from "./types";
import { ttsSpeak, ttsStop } from "../../services/tts";

const CHAT_FACE = require("../../../assets/images/love/chat-face.png");
const USER_FACE = require("../../../assets/images/love/face.png");

type ChatRoute = RouteProp<
  {
    LoveChat: {
      companionId?: string;
      fromCreation?: boolean;
      syncing?: boolean;
    };
  },
  "LoveChat"
>;

type DrawerItem = {
  key: string;
  label: string;
  Icon: typeof LinkIcon;
  onPress: () => void;
  active?: boolean;
};

const modeCopy = (mode: Exclude<LoveMode, "none">) => {
  switch (mode) {
    case "pattern":
      return {
        title: "Pattern mode in Progress",
        body: "Leaving this chat will end voice calling and syncing session.",
        primary: "Stop Pattern",
      };
    case "kink":
      return {
        title: "Kink mode in Progress",
        body: "You cannot start another action when you are in kink mode.",
        primary: "Stop Kink",
      };
    case "bliss":
      return {
        title: "Quick bliss in Progress",
        body: "Leaving this chat will end the Quick bliss session.",
        primary: "Stop Quick bliss",
      };
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
};

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

const renderChatItem = (item: LoveChatItem, name: string, listen: boolean) => {
  switch (item.kind) {
    case "sync":
      return (
        <Text key={item.id} style={styles.syncLine}>
          {`You are now syncing with ${name}`}
        </Text>
      );
    case "bubble":
      return (
        <View
          key={item.id}
          style={[
            styles.bubbleWrap,
            item.from === "me" && styles.bubbleWrapMe,
          ]}
        >
          {item.from === "me" ? (
            <Image source={USER_FACE} style={styles.sentFace} />
          ) : null}
          <View
            style={[
              styles.bubble,
              item.from === "me" ? styles.bubbleMe : styles.bubbleThem,
              item.synced ? styles.bubbleSynced : null,
            ]}
          >
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
          {listen ? (
            <TouchableOpacity
              onPress={() => ttsSpeak({ id: item.id, text: item.text })}
              hitSlop={8}
              style={styles.listenHit}
            >
              <ListenIcon width={s(22)} height={s(22)} />
            </TouchableOpacity>
          ) : null}
        </View>
      );
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
};

export const LoveChatScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const route = useRoute<ChatRoute>();
  const { companions, activeCompanion } = useCompanions();
  const { chat, start, patchChat, minimize, end } = useLoveSession();
  const companion =
    companions.find((item) => item.id === route.params?.companionId) ??
    activeCompanion;
  const name = chat?.name ?? companion?.name ?? "Kevin";
  const fromCreation = route.params?.fromCreation === true;
  const startedSyncing = route.params?.syncing === true;

  const [draft, setDraft] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPage, setDrawerPage] = useState(0);
  const [stopOpen, setStopOpen] = useState(false);
  const [listenBlocked, setListenBlocked] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const listenRef = useRef(false);

  const messages = chat?.messages ?? [];
  const pinned = chat?.pinned ?? true;
  const listen = chat?.listen ?? false;
  const synced = chat?.synced ?? false;
  const inCall = chat?.inCall ?? false;
  const mode = chat?.mode ?? "none";
  listenRef.current = listen;

  useEffect(() => {
    start({
      layer: "chat",
      keepLayer: true,
      companionId: companion?.id,
      name,
      fromCreation,
      syncing: startedSyncing,
    });
  }, [companion?.id, fromCreation, name, start, startedSyncing]);

  const busy = mode !== "none" || synced || inCall;

  const closeSession = () => {
    ttsStop();
    end();
    dismissLoveOverlays(navigation);
  };

  const tryLeave = () => {
    if (busy) {
      setLeaveOpen(true);
      return;
    }
    closeSession();
  };

  const minimizeSession = () => {
    setDrawerOpen(false);
    minimize();
    dismissLoveOverlays(navigation);
  };

  const stopEverything = () => {
    patchChat({
      mode: "none",
      synced: false,
      inCall: false,
    });
    setStopOpen(false);
    setLeaveOpen(false);
    ttsStop();
  };

  const startMode = (next: Exclude<LoveMode, "none">, screen: string) => {
    if (mode !== "none" && mode !== next) {
      setStopOpen(true);
      return;
    }
    if (mode === next) {
      setStopOpen(true);
      return;
    }
    patchChat({ mode: next });
    setDrawerOpen(false);
    minimize();
    dismissLoveOverlays(navigation, { name: screen });
  };

  const openCall = () => {
    if (mode !== "none") {
      setStopOpen(true);
      return;
    }
    patchChat({ inCall: true });
    setDrawerOpen(false);
    start({
      layer: "call",
      companionId: companion?.id,
      name,
    });
    navigation.navigate(
      SCREENS.LOVE_CALL as never,
      { companionId: companion?.id } as never
    );
  };

  const openListen = () => {
    if (inCall) {
      setListenBlocked(true);
      return;
    }
    const next = !listen;
    patchChat({ listen: next });
    if (!next) {
      ttsStop();
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    const id = `${Date.now()}`;
    const history = messages
      .filter((item): item is Extract<typeof item, { kind: "bubble" }> =>
        item.kind === "bubble"
      )
      .map((item) => ({ from: item.from, text: item.text }));
    patchChat((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          kind: "bubble",
          id,
          from: "me",
          text,
          synced: current.synced,
        },
      ],
    }));
    setDraft("");
    setDrawerOpen(false);
    const replyId = `${id}-them`;
    companionChatOrFallback({
      name,
      userText: text,
      history,
      personality: companion?.personalities?.join(", "),
      story: companion?.story,
    }).then((reply) => {
      patchChat((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            kind: "bubble",
            id: replyId,
            from: "them",
            text: reply,
            synced: current.synced || undefined,
          },
        ],
      }));
      if (listenRef.current) {
        ttsSpeak({ id: replyId, text: reply });
      }
    });
  };

  const pageZero: DrawerItem[] = [
    {
      key: "sync",
      label: "Sync",
      Icon: LinkIcon,
      active: synced,
      onPress: () => {
        if (mode !== "none") {
          setStopOpen(true);
          return;
        }
        setDrawerOpen(false);
        patchChat((current) => ({
          ...current,
          synced: true,
          messages: current.messages.some((item) => item.kind === "sync")
            ? current.messages
            : [
                ...current.messages,
                { kind: "sync", id: `sync-${Date.now()}` },
              ],
        }));
        start({
          layer: "sync",
          companionId: companion?.id,
          name,
        });
        navigation.navigate(
          SCREENS.LOVE_SYNC as never,
          { companionId: companion?.id } as never
        );
      },
    },
    {
      key: "call",
      label: "Call",
      Icon: PhoneIcon,
      active: inCall,
      onPress: openCall,
    },
    {
      key: "pin",
      label: pinned ? "Unpin chat" : "Pin chat",
      Icon: PinIcon,
      active: pinned,
      onPress: () => patchChat({ pinned: !pinned }),
    },
    {
      key: "listen",
      label: "Listen",
      Icon: ListenIcon,
      active: listen,
      onPress: openListen,
    },
  ];

  const pageOne: DrawerItem[] = [
    {
      key: "pattern",
      label: "Pattern",
      Icon: PatternIcon,
      active: mode === "pattern",
      onPress: () => startMode("pattern", SCREENS.PATTERN),
    },
    {
      key: "kink",
      label: "Kink",
      Icon: KinkIcon,
      active: mode === "kink",
      onPress: () => startMode("kink", SCREENS.KINK),
    },
    {
      key: "bliss",
      label: "Quick bliss",
      Icon: Heartbeat,
      active: mode === "bliss",
      onPress: () => startMode("bliss", SCREENS.BLISS_STACK),
    },
  ];

  const drawerItems = drawerPage === 0 ? pageZero : pageOne;
  const stop = mode === "none" ? null : modeCopy(mode);

  return (
    <View style={styles.root}>
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
      <BlurView
        style={StyleSheet.absoluteFillObject}
        blurType="dark"
        blurAmount={75}
        reducedTransparencyFallbackColor="#2B2358"
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(108, 108, 108, 0.6)", "rgba(33, 33, 33, 0.6)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={tryLeave}
            hitSlop={8}
            style={styles.headerSide}
          >
            <ChevronBack width={s(35)} height={s(35)} />
          </TouchableOpacity>
          <View style={styles.identity}>
            <Image source={CHAT_FACE} style={styles.avatar} />
            <Text style={styles.name}>{name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setInfoOpen(true)}
            hitSlop={8}
            style={styles.headerSide}
          >
            <Dots width={s(35)} height={s(35)} />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((item) => renderChatItem(item, name, listen))}
          </ScrollView>
          <View
            style={[
              styles.composer,
              {
                paddingBottom: drawerOpen ? s(8) : insets.bottom,
                height: drawerOpen ? s(64) : s(80) + insets.bottom,
              },
            ]}
          >
            <TouchableOpacity onPress={openCall} hitSlop={8}>
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
                placeholder="Hello"
                placeholderTextColor={colors.white}
                onFocus={() => setDrawerOpen(false)}
              />
            </View>
            <TouchableOpacity
              onPress={() => setDrawerOpen((open) => !open)}
              hitSlop={12}
              style={styles.plus}
            >
              <PlusCircle width={s(35)} height={s(35)} />
            </TouchableOpacity>
            <TouchableOpacity onPress={send} hitSlop={8} style={styles.send}>
              <Paperplane width={s(35)} height={s(35)} />
            </TouchableOpacity>
          </View>
          {drawerOpen ? (
            <View style={[styles.drawer, { paddingBottom: insets.bottom }]}>
              <View style={styles.drawerRow}>
                {drawerItems.map((item) => (
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
      <LovePill onPress={minimizeSession} />
      {stopOpen && stop ? (
        <Dialog
          title={stop.title}
          body={stop.body}
          primary={stop.primary}
          secondary="Cancel"
          onPrimary={stopEverything}
          onSecondary={() => setStopOpen(false)}
        />
      ) : null}
      {leaveOpen ? (
        <Dialog
          title={stop?.title ?? "Actions in progress"}
          body={
            stop?.body ??
            "Leaving this chat will end voice calling and syncing session."
          }
          primary={stop?.primary ?? "Leave"}
          secondary="Cancel"
          onPrimary={() => {
            stopEverything();
            closeSession();
          }}
          onSecondary={() => setLeaveOpen(false)}
        />
      ) : null}
      {infoOpen ? (
        <Dialog
          title={name}
          body={
            companion?.story?.trim() ||
            companion?.personalities?.join(", ") ||
            `${name} is your companion.`
          }
          primary="Close"
          secondary="Back"
          onPrimary={() => setInfoOpen(false)}
          onSecondary={() => setInfoOpen(false)}
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#2B2358",
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: s(50),
    marginTop: s(6),
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
  avatar: {
    width: s(50),
    height: s(50),
    borderRadius: s(25),
  },
  name: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
  },
  messages: {
    paddingHorizontal: s(24),
    paddingTop: s(51),
    paddingBottom: s(24),
    gap: s(24),
  },
  bubbleWrap: {
    alignItems: "flex-start",
  },
  bubbleWrapMe: {
    alignItems: "flex-end",
  },
  sentFace: {
    width: s(37),
    height: s(37),
    borderRadius: s(18.5),
    marginBottom: s(8),
  },
  bubble: {
    backgroundColor: colors.grayLightest,
    borderRadius: s(20),
    padding: s(16),
  },
  bubbleThem: {
    width: s(253),
  },
  bubbleMe: {
    width: s(250),
  },
  bubbleSynced: {
    backgroundColor: "rgba(204, 160, 221, 0.3)",
  },
  bubbleText: {
    color: "#fff",
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  listenHit: {
    marginTop: s(8),
  },
  syncLine: {
    alignSelf: "center",
    width: s(292),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  composer: {
    height: s(80),
    backgroundColor: "#4c495f",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: s(8),
    paddingLeft: s(16),
    paddingRight: s(16),
    zIndex: 2,
  },
  inputWrap: {
    width: s(216),
    height: s(48),
    marginLeft: s(16),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: colors.white,
    backgroundColor: colors.grayLightest,
    justifyContent: "center",
    paddingHorizontal: s(16),
  },
  input: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    padding: 0,
  },
  plus: {
    marginLeft: s(16),
    width: s(35),
    height: s(35),
    alignItems: "center",
    justifyContent: "center",
  },
  send: {
    marginLeft: s(8),
  },
  drawer: {
    backgroundColor: "#2f2d3c",
    paddingTop: s(24),
    paddingHorizontal: s(24),
    zIndex: 4,
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
  dialogScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(40),
    zIndex: 30,
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
