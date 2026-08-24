import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SCREENS } from "@common/constant";
import { colors } from "@common/styles/colors";
import { NavigationType } from "../../../App";
import { SimplePage } from "../shared/simple-page";

const TAGS = ["Too strong", "Too weak", "Perfect", "Too short", "Loved it"];

type FeedbackStep = "rate" | "tags" | "note" | "thanks";

export const UserFeedbackScreen = () => {
  const navigation = useNavigation<NavigationType>();
  const [step, setStep] = useState<FeedbackStep>("rate");
  const [rating, setRating] = useState(4);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const goMain = () => {
    const root = navigation.getParent() ?? navigation;
    root.reset({
      index: 0,
      routes: [{ name: SCREENS.MAIN }],
    });
  };

  const toggleTag = (tag: string) => {
    setPicked((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  };

  const primary = (() => {
    switch (step) {
      case "rate":
        return {
          label: "Continue",
          action: () => setStep("tags"),
        };
      case "tags":
        return {
          label: "Continue",
          action: () => setStep("note"),
        };
      case "note":
        return {
          label: "Submit",
          action: () => setStep("thanks"),
        };
      case "thanks":
        return {
          label: "Enter pleasure house",
          action: goMain,
        };
      default: {
        const exhaustive: never = step;
        return exhaustive;
      }
    }
  })();

  return (
    <SimplePage
      title="How was it?"
      onBack={step === "rate" ? goMain : () => setStep("rate")}
      primaryLabel={primary.label}
      onPrimary={primary.action}
      secondaryLabel={step === "thanks" ? undefined : "Skip for now"}
      onSecondary={goMain}
    >
      {step === "rate" ? (
        <View style={styles.center}>
          <Text style={styles.copy}>
            Please rate your experience so we can continue improving your
            journey.
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity key={value} onPress={() => setRating(value)}>
                <Text style={[styles.star, value <= rating && styles.starOn]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
      {step === "tags" ? (
        <View style={styles.center}>
          <Text style={styles.copy}>What stood out?</Text>
          <View style={styles.tags}>
            {TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  picked.includes(tag) ? styles.tagOn : undefined,
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={styles.tagText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
      {step === "note" ? (
        <View style={styles.center}>
          <Text style={styles.copy}>Anything else you want to tell us?</Text>
          <TextInput
            style={styles.note}
            placeholder="Write a note"
            placeholderTextColor={colors.grayLighter}
            multiline
            value={note}
            onChangeText={setNote}
          />
        </View>
      ) : null}
      {step === "thanks" ? (
        <View style={styles.center}>
          <Text style={styles.thanks}>Thanks for your feedback.</Text>
        </View>
      ) : null}
    </SimplePage>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    paddingTop: 48,
  },
  copy: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  stars: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
  },
  star: {
    fontSize: 36,
    color: colors.grayLightest,
  },
  starOn: {
    color: "#F5C16C",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 32,
  },
  tag: {
    backgroundColor: colors.grayLightest,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tagOn: {
    backgroundColor: "rgba(204, 160, 221, 0.6)",
  },
  tagText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
  note: {
    marginTop: 24,
    width: "100%",
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: colors.grayLightest,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    padding: 16,
    textAlignVertical: "top",
  },
  thanks: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
  },
});
