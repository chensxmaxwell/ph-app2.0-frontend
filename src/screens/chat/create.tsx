import React, { useState } from "react";
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
import {
  NavigationProp,
  ParamListBase,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import ChevronBack from "@images/avatar/chevron-back.svg";
import { s } from "../avatar/scale";
import { ChatGradient } from "./background";
import { openAvatarWizard } from "../avatar/open";
import { useCompanions } from "../../store/companions";
import { useChat } from "./store";

type CreateRoute = RouteProp<
  { ChatCreate: { threadId?: string } | undefined },
  "ChatCreate"
>;

export const ChatCreateScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<CreateRoute>();
  const { createBot, updateBot, getThread } = useChat();
  const { companions, updateCompanion } = useCompanions();
  const existing = route.params?.threadId
    ? getThread(route.params.threadId)
    : undefined;
  const [name, setName] = useState(existing?.name ?? "Kevin");
  const [gender, setGender] = useState(existing?.gender ?? "Male");
  const [birthday, setBirthday] = useState(existing?.birthday ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [createdId, setCreatedId] = useState<string | null>(
    existing ? existing.id : null
  );
  const [done, setDone] = useState(false);

  const editing = Boolean(existing);

  const submit = () => {
    if (existing) {
      updateBot(existing.id, { name, gender, birthday, description });
      if (companions.some((item) => item.id === existing.id)) {
        updateCompanion(existing.id, {
          name: name.trim() || existing.name,
          gender,
          birthday,
          story: description,
        });
      }
      setCreatedId(existing.id);
      setDone(true);
      return;
    }
    const id = createBot({ name, gender, birthday, description });
    setCreatedId(id);
    setDone(true);
  };

  if (done && createdId) {
    return (
      <ChatGradient>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
              <ChevronBack width={s(35)} height={s(35)} />
            </TouchableOpacity>
          </View>
          <View style={styles.success}>
            <View style={styles.initial}>
              <Text style={styles.initialText}>
                {(name || "K").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.successTitle}>{name || "Kevin"}</Text>
            <Text style={styles.successBody}>
              {editing
                ? `You have saved ${name || "Kevin"}.`
                : `You have successfully created ${name || "Kevin"}. Start chatting with ${name || "Kevin"} or create an avatar.`}
            </Text>
            <TouchableOpacity
              style={styles.primary}
              onPress={() =>
                navigation.navigate(
                  SCREENS.CHAT_THREAD as never,
                  { threadId: createdId } as never
                )
              }
            >
              <Text style={styles.primaryText}>Start chatting</Text>
            </TouchableOpacity>
            {editing ? null : (
              <TouchableOpacity
                style={styles.primary}
                onPress={() =>
                  openAvatarWizard(navigation, {
                    mode: "create",
                    companionId: createdId,
                  })
                }
              >
                <Text style={styles.primaryText}>Create avatar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.link}>Return</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ChatGradient>
    );
  }

  return (
    <ChatGradient>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <ChevronBack width={s(35)} height={s(35)} />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Kevin"
              placeholderTextColor={colors.grayLighter}
            />
            <Text style={styles.label}>Gender</Text>
            <TextInput
              value={gender}
              onChangeText={setGender}
              style={styles.input}
              placeholder="Male"
              placeholderTextColor={colors.grayLighter}
            />
            <Text style={styles.label}>Birthday</Text>
            <TextInput
              value={birthday}
              onChangeText={setBirthday}
              style={styles.input}
              placeholder="mm/dd/yyyy"
              placeholderTextColor={colors.grayLighter}
            />
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.area]}
              placeholder="Add description of your character here."
              placeholderTextColor={colors.grayLighter}
              multiline
              maxLength={3000}
            />
            <Text style={styles.counter}>{`${description.length}/3000`}</Text>
            <TouchableOpacity style={styles.primary} onPress={submit}>
              <Text style={styles.primaryText}>Save</Text>
            </TouchableOpacity>
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
  header: {
    height: s(50),
    paddingHorizontal: s(16),
    justifyContent: "center",
  },
  form: {
    paddingHorizontal: s(24),
    paddingBottom: s(40),
  },
  label: {
    marginTop: s(16),
    marginBottom: s(8),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  input: {
    minHeight: s(48),
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    paddingHorizontal: s(16),
  },
  area: {
    minHeight: s(120),
    paddingTop: s(12),
    textAlignVertical: "top",
  },
  counter: {
    marginTop: s(8),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "right",
  },
  primary: {
    marginTop: s(16),
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
    marginTop: s(16),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
    textAlign: "center",
  },
  success: {
    flex: 1,
    paddingHorizontal: s(32),
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    width: s(88),
    height: s(88),
    borderRadius: s(44),
    backgroundColor: colors.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 32,
  },
  successTitle: {
    marginTop: s(16),
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 24,
  },
  successBody: {
    marginTop: s(16),
    marginBottom: s(24),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
});
