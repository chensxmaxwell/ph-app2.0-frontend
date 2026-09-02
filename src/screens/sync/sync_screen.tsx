import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import MinimizeIcon from "@images/minimize.svg";
import Xmark from "@images/icons/xmark.svg";
import Speaker from "@images/speaker.svg";
import MicroPhone_unmute from "@images/microphone-unmute.svg";
import MicroPhone_mute from "@images/microphone-mute.svg";
import { usePatternPlayer } from "../../hooks/usePatternPlayer";
import { wavePattern } from "../../store/patterns";
import { lookFromCompanion, useCompanions } from "../../store/companions";
import { LookFace } from "../avatar/look-face";
import { useLoveSession } from "../love/session";
import { faceSourceForId } from "../chat/faces";

const AVATAR_SIZE = 100;

const SyncScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const params = route.params as
    | { name?: string; companionId?: string }
    | undefined;
  const partnerName = params?.name?.trim() || "Kevin";
  const partnerId = params?.companionId?.trim() || `sync-${partnerName}`;
  const { companions } = useCompanions();
  const partner = companions.find((item) => item.id === partnerId);
  const { start: startSession, minimize, ensureLayerTimer } = useLoveSession();
  const [syncState, setSyncState] = useState("SYNC_ONGOING");
  const { start, stop } = usePatternPlayer(wavePattern(72), "sync");
  //   SYNC_INVITATION_SENT
  //   SYNC_ACCEPTED
  //   SYNC_REQUEST_RECEIVED
  //   USER_BUSY
  //   SYNC_ACTIVE_CONFIRMATION
  //   SYNC_ONGOING

  const [isMuted, setIsMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  const leaveSyncStack = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.goBack();
      return;
    }
    navigation.goBack();
  };

  const hangupSync = () => {
    stop();
    leaveSyncStack();
  };

  const minimizeSync = () => {
    // Origin is the Control hub card, not a Love chat: the pill restores
    // LoveSync straight onto the hub and red X ends the session there.
    startSession({
      layer: "sync",
      surface: "control",
      companionId: partnerId,
      name: partnerName,
      syncing: true,
    });
    ensureLayerTimer("sync", Date.now() - elapsedTime * 1000);
    minimize();
    leaveSyncStack();
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    if (syncState === "SYNC_ONGOING") {
      start();
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      stop();
    }

    return () => {
      stop();
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [start, stop, syncState]);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const renderHeader = () => {
    switch (syncState) {
      case "SYNC_ACTIVE_CONFIRMATION":
      case "SYNC_ONGOING":
        return (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{partnerName}</Text>
            <TouchableOpacity
              testID="control-sync-minimize"
              style={styles.minimizeIcon}
              onPress={minimizeSync}
            >
              <MinimizeIcon width={35} height={35} />
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  const renderAvatar = () => {
    let backgroundSource = null;

    switch (syncState) {
      case "SYNC_INVITATION_SENT":
      case "SYNC_REQUEST_RECEIVED":
        backgroundSource = require("../../../assets/images/eclipse-white.png");
        break;
      case "SYNC_ACCEPTED":
      case "SYNC_ACTIVE_CONFIRMATION":
      case "SYNC_ONGOING":
        backgroundSource = require("../../../assets/images/eclipse-pink.png");
        break;
      case "USER_BUSY":
      default:
        backgroundSource = null;
    }

    // Every state, including the live ones, shows the person picked on the
    // selection screen; any stock portrait here reads as Kevin regardless.
    return (
      <View style={[styles.avatarContainer]}>
        {syncState === "SYNC_ONGOING" && (
          <Text style={styles.timeText}>{formatTime(elapsedTime)}</Text>
        )}
        <Image source={backgroundSource} style={styles.background} />
        <View style={styles.avatar}>
          <LookFace
            look={partner ? lookFromCompanion(partner) : null}
            size={AVATAR_SIZE}
            fallbackSource={faceSourceForId(partnerId)}
          />
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    switch (syncState) {
      case "SYNC_INVITATION_SENT":
        return (
          <View style={styles.footer}>
            <View>
              <Text style={styles.text}>Sync invitation sent</Text>
              <Text style={styles.subText}>
                {`Waiting for ${partnerName} to accept your invitation.`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.button1}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText1}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
      case "SYNC_ACCEPTED":
        return (
          <View style={styles.footer}>
            <View>
              <Text style={styles.text}>
                {`${partnerName} has accepted your sync invitation`}
              </Text>
            </View>
            <View>
              <TouchableOpacity
                style={styles.button1}
                onPress={() => setSyncState("SYNC_ONGOING")}
              >
                <Text style={styles.buttonText1}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button2}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.buttonText2}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case "SYNC_REQUEST_RECEIVED":
        return (
          <View style={styles.footer}>
            <View>
              <Text style={styles.text}>{`${partnerName} wants to sync`}</Text>
            </View>
            <View>
              <TouchableOpacity
                style={styles.button1}
                onPress={() => setSyncState("SYNC_ONGOING")}
              >
                <Text style={styles.buttonText1}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button2}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.buttonText2}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case "USER_BUSY":
        return (
          <View style={styles.footer}>
            <View>
              <Text style={styles.text}>
                {`Looks like ${partnerName} is busy right now`}
              </Text>
            </View>
            <View>
              <TouchableOpacity
                style={styles.button1}
                onPress={() => setSyncState("SYNC_INVITATION_SENT")}
              >
                <Text style={styles.buttonText1}>Resend invite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button2}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.buttonText2}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case "SYNC_ACTIVE_CONFIRMATION":
        return (
          <View style={[styles.footer, { justifyContent: "flex-end" }]}>
            <View>
              <Text style={styles.text}>
                {`${partnerName} has accepted your sync invitation`}
              </Text>
            </View>
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TouchableOpacity
                style={{
                  height: 73,
                  width: 73,
                  borderRadius: 100,
                  backgroundColor: "#CCA0DD99",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={hangupSync}
              >
                <Xmark width={20} height={20}></Xmark>
              </TouchableOpacity>
            </View>
          </View>
        );
      case "SYNC_ONGOING":
        return (
          <View style={[styles.footer, { justifyContent: "flex-end" }]}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <TouchableOpacity
                style={[
                  {
                    height: 73,
                    width: 73,
                    borderRadius: 100,

                    alignItems: "center",
                    justifyContent: "center",
                  },
                  {
                    backgroundColor: isMuted ? colors.grayLightest: colors.grayLighter,
                  },
                ]}
                onPress={() => setIsMuted(!isMuted)}
              >
                {isMuted ? (
                  <MicroPhone_mute width={35} height={35} />
                ) : (
                  <MicroPhone_unmute width={35} height={35} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                testID="control-sync-hangup"
                style={{
                  height: 73,
                  width: 73,
                  borderRadius: 100,
                  backgroundColor: "#F95F6E99",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={hangupSync}
              >
                <Xmark width={20} height={20}></Xmark>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  height: 73,
                  width: 73,
                  borderRadius: 100,
                  backgroundColor: speakerOn
                    ? colors.grayLightest
                    : colors.grayLighter,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => setSpeakerOn((current) => !current)}
              >
                <Speaker width={35} height={35}></Speaker>
              </TouchableOpacity>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      {/* render header */}
      {renderHeader()}

      <View style={styles.container}>
        {renderAvatar()}
        {renderFooter()}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    width: "100%",
    position: "relative",
  },
  headerTitle: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    position: "absolute",
    width: "100%",
  },
  minimizeIcon: {
    width: 35,
    height: 35,
  },
  container: {
    flex: 1,
    paddingTop: 60,
    justifyContent: "space-between",
  },
  avatarContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 300,
    height: 300,
    position: "relative",
  },
  background: {
    width: 300,
    height: 300,
    position: "absolute",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    position: "absolute",
  },
  timeText: {
    position: "absolute",
    top: 0,
    fontSize: fontSizes.large,
    fontWeight: fontWeights.bold,
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
  },
  footer: {
    display: "flex",
    height: "50%",
    justifyContent: "space-evenly",
  },
  text: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    lineHeight: 25,
    textAlign: "center",
  },
  subText: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    lineHeight: 25,
  },
  button1: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.grayLightest,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText1: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
  },
  button2: {
    width: "100%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText2: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontFamily: "Quicksand",
    fontWeight: fontWeights.bold,
  },
});

export default SyncScreen;
