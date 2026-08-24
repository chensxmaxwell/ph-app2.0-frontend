import React, { useMemo, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import ChevronBack from "@images/avatar/chevron-back.svg";
import PersonPlus from "@images/message/person-plus.svg";
import { s } from "../avatar/scale";
import { ChatGradient } from "./background";
import { useChat } from "./store";

const PHOTO = require("../../../assets/images/message/kevin-photo.png");

type ContactRoute = RouteProp<
  { ChatContact: { personId: string } },
  "ChatContact"
>;

export const ChatContactScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ContactRoute>();
  const { directory, sendFriendRequest, cancelFriendRequest, threads } =
    useChat();
  const person = directory.find((item) => item.id === route.params.personId);
  const existing = threads.find((thread) => thread.id === person?.id);
  const [sent, setSent] = useState(existing?.request === "sent");
  const [canceled, setCanceled] = useState(false);

  const chips = useMemo(
    () =>
      person
        ? [person.gender, person.birthday, person.plan].filter(Boolean)
        : [],
    [person]
  );

  if (!person) {
    return null;
  }

  return (
    <ChatGradient>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <ChevronBack width={s(35)} height={s(35)} />
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          <Image source={PHOTO} style={styles.hero} />
          <Image source={PHOTO} style={styles.badge} />
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.email}>{person.email}</Text>
          <View style={styles.chips}>
            {chips.map((chip) => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))}
          </View>
          {canceled ? (
            <Text style={styles.note}>Friend request canceled</Text>
          ) : sent ? (
            <Text style={styles.note}>
              Friend request sent You can find your request status in Message
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.primary}
            onPress={() => {
              if (
                existing &&
                (existing.request === "incoming" ||
                  existing.request === "accepted" ||
                  existing.request === "none")
              ) {
                navigation.navigate(
                  SCREENS.CHAT_THREAD as never,
                  { threadId: existing.id } as never
                );
                return;
              }
              if (sent) {
                cancelFriendRequest(person.id);
                setCanceled(true);
                setSent(false);
                return;
              }
              const id = sendFriendRequest(person);
              setSent(true);
              setCanceled(false);
              navigation.navigate(
                SCREENS.CHAT_THREAD as never,
                { threadId: id } as never
              );
            }}
          >
            <PersonPlus width={s(35)} height={s(35)} />
            <Text style={styles.primaryText}>
              {existing && existing.request !== "sent"
                ? existing.request === "incoming"
                  ? "Respond"
                  : "Start chatting"
                : sent
                ? "Cancel request"
                : "Request chat"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ChatGradient>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: s(50),
    paddingHorizontal: s(16),
    justifyContent: "center",
  },
  body: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: s(24),
  },
  hero: {
    width: s(345),
    height: s(280),
    borderBottomLeftRadius: s(24),
    borderBottomRightRadius: s(24),
  },
  badge: {
    width: s(72),
    height: s(72),
    borderRadius: s(36),
    marginTop: s(-36),
    borderWidth: 2,
    borderColor: colors.white,
  },
  name: {
    marginTop: s(16),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 24,
  },
  email: {
    marginTop: s(8),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  chips: {
    marginTop: s(16),
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: s(8),
  },
  chip: {
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    paddingHorizontal: s(12),
    paddingVertical: s(8),
  },
  chipText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  note: {
    marginTop: s(24),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  primary: {
    marginTop: s(32),
    height: s(50),
    width: "100%",
    borderRadius: s(25),
    backgroundColor: colors.grayLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
  },
  primaryText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
});
