import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SimplePage } from "../shared/simple-page";

const FACE = require("../../../assets/images/message/kevin.png");

const STARTER = [
  { id: "1", name: "Kevin", text: "This one hit different." },
  { id: "2", name: "Amanda", text: "Saving this for later tonight." },
  { id: "3", name: "Chad", text: "Hardcore is the move." },
];

export const FeedScreen = () => {
  const navigation = useNavigation();
  const [comments, setComments] = useState(STARTER);
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setComments((current) => [
      ...current,
      { id: `${current.length + 1}`, name: "You", text },
    ]);
    setDraft("");
  };

  return (
    <SimplePage title="Feed" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.list}>
        {comments.map((item) => (
          <View key={item.id} style={styles.row}>
            <Image source={FACE} style={styles.avatar} />
            <View style={styles.bubble}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.text}>{item.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Write a comment"
          placeholderTextColor={colors.grayLighter}
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity onPress={send}>
          <Text style={styles.send}>Send</Text>
        </TouchableOpacity>
      </View>
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  bubble: {
    flex: 1,
    backgroundColor: colors.grayLight,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  name: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  text: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grayLightest,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    paddingHorizontal: 16,
  },
  send: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});
