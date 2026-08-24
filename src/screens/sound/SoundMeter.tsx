import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import Xmark from "@images/xmark.svg";
import LinearGradient from "react-native-linear-gradient";
import LightBulb from "@images/lightbulb.svg";
import Stop from "@images/stop.svg";
import Resume from "@images/resume.svg";
import { SCREENS } from "@common/constant";
import WaveformAdjustable from "./Wave";
import AudioRecorderPlayer from "react-native-audio-recorder-player";
import { useHomeScreen } from "../../hooks/HomeScreenContext";

const SoundMeter = () => {
  const navigation = useNavigation();
  const { setCurrentMode, setMotorInput } = useHomeScreen();
  const [stop, setStop] = useState(true);
  const [dBLevel, setdBLevel] = useState(100);

  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  // Function to toggle between stopping and resuming
  const toggleStop = async () => {
    // setdBLevel(100);
    if (stop) {
      // Resume recording
      await audioRecorderPlayer.startRecorder();
    } else {
      // Stop recording
      await audioRecorderPlayer.stopRecorder();
    }
    setStop(!stop); // Toggle the stop state
  };

  useEffect(() => {
    audioRecorderPlayer.addRecordBackListener((e) => {
      const meteringValue = e.currentMetering ?? 20;
      setdBLevel(Math.round(meteringValue));
    });
    return () => {
      audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setCurrentMode("");
      setMotorInput([]);
    };
  }, [audioRecorderPlayer, setCurrentMode, setMotorInput]);

  useEffect(() => {
    if (stop) {
      setCurrentMode("");
      setMotorInput([]);
      return;
    }
    const level = Math.max(8, Math.min(100, Math.abs(dBLevel) * 2));
    setCurrentMode("sound");
    setMotorInput([1, level, level, level]);
  }, [dBLevel, setCurrentMode, setMotorInput, stop]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#2B2358", "#2B2358"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["#5E5DBF", "rgba(50, 41, 105, 0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sound</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <Xmark width={35} height={35} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.lightbulbIcon}
          onPress={() => navigation.navigate(SCREENS.SOUND_INTRO)}
        >
          <LightBulb width={35} height={35} />
        </TouchableOpacity>
      </View>

      {/* Sound Level Display */}
      <View style={styles.soundLevelContainer}>
        <Text style={styles.soundLevelText}>{dBLevel}</Text>
        <Text style={styles.dbText}>dB level</Text>
        <TouchableOpacity style={styles.pauseButton} onPress={toggleStop}>
          {stop ? (
            <Resume width={35} height={35} />
          ) : (
            <Stop width={35} height={35} />
          )}
        </TouchableOpacity>
      </View>

      <WaveformAdjustable />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "space-between",
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginTop: 60,
  },
  headerTitle: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  backIcon: {
    position: "absolute",
    left: 20,
    top: 0,
    width: 35,
    height: 35,
  },
  lightbulbIcon: {
    position: "absolute",
    right: 20,
    top: 0,
    width: 35,
    height: 35,
  },
  soundLevelContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  soundLevelText: {
    fontSize: 90,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
  },
  dbText: {
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    color: colors.white,
    marginBottom: 20,
  },
  pauseButton: {
    width: 59,
    height: 59,
    backgroundColor: colors.grayLightest,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SoundMeter;
