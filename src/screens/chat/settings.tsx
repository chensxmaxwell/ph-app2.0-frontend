import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
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
import ChevronBack from "@images/avatar/chevron-back.svg";
import Pencil from "@images/message/pencil.svg";
import { useCompanions } from "../../store/companions";
import { AvatarPicker } from "../avatar/avatar-picker";
import { LookFace } from "../avatar/look-face";
import { openAvatarWizard, openEditPersona } from "../avatar/open";
import { s } from "../avatar/scale";
import { usePersonFace } from "../avatar/use-person-face";
import { ChatGradient } from "./background";
import { findPerson } from "./person";
import { useChat } from "./store";

type SettingsRoute = RouteProp<
  { ChatSettings: { threadId: string } },
  "ChatSettings"
>;

const Field = ({ label, value }: { label: string; value?: string }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.valueBox}>
      <Text style={styles.value} numberOfLines={3}>
        {value || "—"}
      </Text>
    </View>
  </View>
);

export const ChatSettingsScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<SettingsRoute>();
  const { threads } = useChat();
  const { companions } = useCompanions();
  const thread = threads.find((item) => item.id === route.params.threadId);
  // A 3D companion named after a seeded bot lives under the seed's thread id
  // but its own record id; pair through findPerson, not a bare id match.
  const companion = findPerson(thread?.id, threads, companions)?.companion;
  const { face, options, choose } = usePersonFace(
    route.params.threadId,
    thread?.kind
  );

  if (!thread) {
    return null;
  }

  // Same Identity form whether this person already has a 3D companion record
  // or is still a chat-only bot; the save path decides what gets written.
  const openTraits = () => openEditPersona(navigation, thread.id);

  return (
    <ChatGradient>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <ChevronBack width={s(35)} height={s(35)} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openTraits}>
            <Pencil width={s(35)} height={s(35)} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {face.look ? (
            <View style={styles.portraitWrap}>
              <LookFace look={face.look} size={s(160)} />
            </View>
          ) : (
            <Image source={face.source} style={styles.portrait} />
          )}
          {options.length > 1 && choose ? (
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerTitle}>Avatar</Text>
              <Text style={styles.pickerHint}>
                {`Pick the face ${thread.name} uses on Home, Message and Love.`}
              </Text>
              <AvatarPicker
                options={options}
                selected={face.kind}
                onSelect={choose}
              />
            </View>
          ) : null}
          {companion ? (
            <>
              <TouchableOpacity
                style={styles.traits}
                onPress={() =>
                  openAvatarWizard(navigation, {
                    mode: "editLook",
                    companionId: companion.id,
                  })
                }
              >
                <Text style={styles.traitsText}>Edit avatar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.traits} onPress={openTraits}>
                <Text style={styles.traitsText}>Edit persona</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                testID="chat-settings-edit-persona"
                style={styles.traits}
                onPress={openTraits}
              >
                <Text style={styles.traitsText}>Edit persona</Text>
              </TouchableOpacity>
              {thread.kind === "bot" ? (
                <TouchableOpacity
                  style={styles.traits}
                  onPress={() =>
                    openAvatarWizard(navigation, {
                      mode: "create",
                      companionId: thread.id,
                    })
                  }
                >
                  <Text style={styles.traitsText}>Create avatar</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
          <Field label="Name" value={companion?.name ?? thread.name} />
          <Field label="Gender" value={companion?.gender ?? thread.gender} />
          <Field
            label="Birthday"
            value={companion?.birthday ?? thread.birthday}
          />
          <Field
            label="Description"
            value={companion?.story ?? thread.description}
          />
          {companion?.personalities?.length || thread.personality ? (
            <Field
              label="Personality"
              value={companion?.personalities?.join(", ") || thread.personality}
            />
          ) : null}
        </ScrollView>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  body: {
    paddingHorizontal: s(24),
    paddingBottom: s(40),
    alignItems: "center",
  },
  portrait: {
    width: s(345),
    height: s(280),
    borderRadius: s(24),
  },
  portraitWrap: {
    width: s(160),
    height: s(160),
    alignItems: "center",
    justifyContent: "center",
  },
  pickerWrap: {
    width: "100%",
    marginTop: s(16),
    paddingVertical: s(16),
    paddingHorizontal: s(16),
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    alignItems: "center",
    gap: s(12),
  },
  pickerTitle: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  pickerHint: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
  traits: {
    marginTop: s(16),
    width: "100%",
    height: s(50),
    borderRadius: s(25),
    backgroundColor: "#cbb7e8",
    alignItems: "center",
    justifyContent: "center",
  },
  traitsText: {
    color: "#2A2659",
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  field: {
    width: "100%",
    marginTop: s(16),
  },
  label: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    marginBottom: s(8),
  },
  valueBox: {
    minHeight: s(48),
    borderRadius: s(16),
    backgroundColor: colors.grayLight,
    justifyContent: "center",
    paddingHorizontal: s(16),
    paddingVertical: s(12),
  },
  value: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});
