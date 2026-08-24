import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SCREENS } from "../../common/constant/index";
import MinimizeIcon from "@images/minimize.svg";
import Xmark from "@images/icons/xmark.svg";
import Speaker from "@images/speaker.svg";
import MicroPhone_unmute from "@images/microphone-unmute.svg";
import MicroPhone_mute from "@images/microphone-mute.svg";
import { usePatternPlayer } from "../../hooks/usePatternPlayer";
import { wavePattern } from "../../store/patterns";

const SyncScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const partnerName =
    (route.params as { name?: string } | undefined)?.name?.trim() || "Kevin";
  const [syncState, setSyncState] = useState("SYNC_ONGOING");
  const { start, stop } = usePatternPlayer(wavePattern(72), "sync");
  //   SYNC_INVITATION_SENT
  //   SYNC_ACCEPTED
  //   SYNC_REQUEST_RECEIVED
  //   USER_BUSY
  //   SYNC_ACTIVE_CONFIRMATION
  //   SYNC_ONGOING

  const [isMuted, setIsMuted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

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
              style={styles.minimizeIcon}
              onPress={() => navigation.goBack()}
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
    let ringSource = null;

    switch (syncState) {
      case "SYNC_INVITATION_SENT":
        backgroundSource = require("../../../assets/images/eclipse-white.png");
        ringSource = require("../../../assets/images/avatar.png");
        break;
      case "SYNC_ACCEPTED":
        backgroundSource = require("../../../assets/images/eclipse-pink.png");
        ringSource = require("../../../assets/images/avatar.png");
        break;
      case "SYNC_REQUEST_RECEIVED":
        backgroundSource = require("../../../assets/images/eclipse-white.png");
        ringSource = require("../../../assets/images/avatar.png");
        break;
      case "USER_BUSY":
        ringSource = require("../../../assets/images/avatar.png");
        break;
      case "SYNC_ACTIVE_CONFIRMATION":
        backgroundSource = require("../../../assets/images/eclipse-pink.png");
        ringSource = require("../../../assets/images/avatar-ring.png");
        break;
      case "SYNC_ONGOING":
        backgroundSource = require("../../../assets/images/eclipse-pink.png");
        ringSource = require("../../../assets/images/avatar-ring.png");
        break;
      default:
        backgroundSource = null;
        ringSource = null;
    }

    return (
      <View style={[styles.avatarContainer]}>
        {syncState === "SYNC_ONGOING" && (
          <Text style={styles.timeText}>{formatTime(elapsedTime)}</Text>
        )}
        <Image source={backgroundSource} style={styles.background} />
        <Image source={ringSource} style={styles.avatar} />
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
                onPress={() => navigation.goBack()}
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
                style={{
                  height: 73,
                  width: 73,
                  borderRadius: 100,
                  backgroundColor: "#F95F6E99",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => navigation.goBack()}
              >
                <Xmark width={20} height={20}></Xmark>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  height: 73,
                  width: 73,
                  borderRadius: 100,
                  backgroundColor: colors.grayLightest,
                  alignItems: "center",
                  justifyContent: "center",
                }}
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
    width: 100,
    height: 100,
    borderRadius: 50,
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
