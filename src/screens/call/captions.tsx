import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@common/styles/colors";
import { s } from "../avatar/scale";
import type { VoiceCall } from "./use-voice-call";

type CallCaptionsProps = {
  name: string;
  // The phase line above the captions: `callStatusLabel` on a call,
  // `syncStatusLabel` on Sync.
  status: string;
  call: VoiceCall;
  centered: boolean;
};

// What the hands-free loop shows while it runs: the phase, the last thing
// heard, the last reply, a notice when something needs the user, and the
// phone's-voice hint. Rendered under the face on a call and on Sync.
export const CallCaptions = ({
  name,
  status,
  call,
  centered,
}: CallCaptionsProps) => (
  <View style={[styles.captions, centered && styles.captionsCentered]}>
    <Text testID="call-status" style={styles.status}>
      {status}
    </Text>
    {call.heard ? (
      <View style={styles.captionBlock}>
        <Text style={styles.captionWho}>You</Text>
        <Text testID="call-heard" style={styles.captionText} numberOfLines={3}>
          {call.heard}
        </Text>
      </View>
    ) : null}
    {call.reply ? (
      <View style={styles.captionBlock}>
        <Text style={styles.captionWho}>{name}</Text>
        <Text testID="call-reply" style={styles.captionText} numberOfLines={4}>
          {call.reply}
        </Text>
      </View>
    ) : null}
    {call.notice ? (
      <View style={styles.notice}>
        <Text testID="call-notice" style={styles.noticeText}>
          {call.notice}
        </Text>
      </View>
    ) : null}
    {call.voiceHint ? (
      <Text testID="call-voice-hint" style={styles.hint}>
        {call.voiceHint}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  captions: {
    marginTop: s(16),
    gap: s(10),
    paddingHorizontal: s(24),
    width: "100%",
  },
  captionsCentered: {
    alignItems: "center",
  },
  status: {
    color: colors.white,
    fontFamily: "OpenSans-Bold",
    fontSize: 20,
  },
  captionBlock: {
    gap: s(2),
  },
  captionWho: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 11,
  },
  captionText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 14,
    lineHeight: 19,
  },
  notice: {
    maxWidth: s(300),
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
  hint: {
    maxWidth: s(300),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    opacity: 0.8,
  },
});
