import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import ChevronBack from "@images/avatar/chevron-back.svg";
import SearchIcon from "@images/message/search.svg";
import PersonPlus from "@images/message/person-plus.svg";
import Paperplane from "@images/love/paperplane.svg";
import { LookFace } from "../avatar/look-face";
import { s } from "../avatar/scale";
import { useFaceResolver } from "../avatar/use-person-face";
import { ChatGradient } from "./background";
import { useChat } from "./store";

type SearchRoute = RouteProp<
  { ChatSearch: { addFriends?: boolean } | undefined },
  "ChatSearch"
>;

export const ChatSearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<SearchRoute>();
  const { threads, directory } = useChat();
  const faceFor = useFaceResolver();
  const [query, setQuery] = useState(route.params?.addFriends ? "" : "Chad");
  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!needle) {
      return [];
    }
    const people = directory
      .filter(
        (person) =>
          person.name.toLowerCase().includes(needle) ||
          person.email.toLowerCase().includes(needle)
      )
      .map((person) => ({
        key: `dir-${person.id}`,
        kind: "person" as const,
        personId: person.id,
        title: person.name,
        subtitle: person.email,
        person,
      }));
    const chats = threads
      .flatMap((thread) => {
        const nameHit = thread.name.toLowerCase().includes(needle);
        const hits = thread.messages.filter((message) =>
          message.text.toLowerCase().includes(needle)
        );
        if (!nameHit && hits.length === 0) {
          return [];
        }
        if (hits.length === 0) {
          return [
            {
              key: `thread-${thread.id}`,
              kind: "thread" as const,
              personId: thread.id,
              title: thread.name,
              subtitle: thread.email,
              threadId: thread.id,
            },
          ];
        }
        return hits.slice(0, 2).map((message) => ({
          key: `msg-${message.id}`,
          kind: "thread" as const,
          personId: thread.id,
          title: thread.name,
          subtitle: message.text,
          threadId: thread.id,
        }));
      });
    return [...people, ...chats];
  }, [directory, needle, threads]);

  return (
    <ChatGradient>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.searchRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
              <ChevronBack width={s(35)} height={s(35)} />
            </TouchableOpacity>
            <View style={styles.searchBar}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search for existing contact"
                placeholderTextColor={colors.grayLighter}
                style={styles.input}
                autoFocus
              />
              <SearchIcon width={s(33)} height={s(35)} />
            </View>
          </View>
          <Text style={styles.heading}>Search results</Text>
          <View style={styles.rule} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
          >
            {results.map((item) => (
              <View key={item.key} style={styles.card}>
                <LookFace
                  look={faceFor(item.personId).look}
                  size={s(60)}
                  fallbackSource={faceFor(item.personId).source}
                />
                <View style={styles.copy}>
                  <Text style={styles.name}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => {
                    if (item.kind === "person") {
                      navigation.replace(
                        SCREENS.CHAT_CONTACT as never,
                        { personId: item.person.id } as never
                      );
                      return;
                    }
                    navigation.replace(
                      SCREENS.CHAT_THREAD as never,
                      { threadId: item.threadId } as never
                    );
                  }}
                >
                  {item.kind === "person" ? (
                    <PersonPlus width={s(35)} height={s(35)} />
                  ) : (
                    <Paperplane width={s(35)} height={s(35)} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  searchRow: {
    paddingHorizontal: s(16),
    paddingTop: s(8),
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
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
  },
  input: {
    flex: 1,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    padding: 0,
  },
  heading: {
    marginTop: s(24),
    marginHorizontal: s(24),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
  },
  rule: {
    marginTop: s(16),
    marginHorizontal: s(24),
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.grayLighter,
  },
  list: {
    paddingHorizontal: s(24),
    paddingTop: s(24),
    gap: s(16),
    paddingBottom: s(40),
  },
  card: {
    height: s(90),
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(15),
  },
  copy: {
    flex: 1,
    marginLeft: s(18),
    marginRight: s(8),
  },
  name: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  sub: {
    marginTop: s(8),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  action: {
    width: s(60),
    height: s(60),
    borderRadius: s(30),
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
  },
});
