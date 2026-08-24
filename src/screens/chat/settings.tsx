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
import { SCREENS } from "@common/constant";
import ChevronBack from "@images/avatar/chevron-back.svg";
import Pencil from "@images/message/pencil.svg";
import { lookFromCompanion, useCompanions } from "../../store/companions";
import { LookFace } from "../avatar/look-face";
import { openAvatarWizard } from "../avatar/open";
import { s } from "../avatar/scale";
import { ChatGradient } from "./background";
import { useChat } from "./store";

const FACE = require("../../../assets/images/message/kevin.png");
const PHOTO = require("../../../assets/images/message/kevin-photo.png");

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
  const { getThread } = useChat();
  const { companions } = useCompanions();
  const thread = getThread(route.params.threadId);
  const companion = companions.find((item) => item.id === thread?.id);

  if (!thread) {
    return null;
  }

  const openTraits = () => {
    if (companion) {
      openAvatarWizard(navigation, {
        mode: "editPersona",
        companionId: companion.id,
      });
      return;
    }
    navigation.navigate(
      SCREENS.CHAT_CREATE as never,
      { threadId: thread.id } as never
    );
  };

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
          {companion ? (
            <View style={styles.portraitWrap}>
              <LookFace look={lookFromCompanion(companion)} size={s(160)} />
            </View>
          ) : (
            <Image
              source={thread.kind === "human" ? PHOTO : FACE}
              style={styles.portrait}
            />
          )}
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
              <TouchableOpacity style={styles.traits} onPress={openTraits}>
                <Text style={styles.traitsText}>Edit traits</Text>
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
              value={
                companion?.personalities?.join(", ") || thread.personality
              }
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
