import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
} from "react-native";
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
import {
  MIC_ERROR_MESSAGES,
  startMicSession,
  stopMicSession,
} from "../../services/mic-session";

const SoundMeter = () => {
  const navigation = useNavigation();
  const { setCurrentMode, setMotorInput } = useHomeScreen();
  const [stop, setStop] = useState(true);
  const [dBLevel, setdBLevel] = useState(0);
  const [intensity, setIntensity] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  const startMic = async () => {
    const result = await startMicSession({
      platform: Platform.OS,
      requestAndroidAudio: async () => {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      },
      startRecorder: async () => {
        audioRecorderPlayer.setSubscriptionDuration(0.08);
        await audioRecorderPlayer.startRecorder(undefined, undefined, true);
      },
    });
    if (!result.ok) {
      setMicError(result.message);
      return false;
    }
    setMicError(null);
    return true;
  };

  const haltMic = async () => {
    await stopMicSession(() => audioRecorderPlayer.stopRecorder());
    setStop(true);
    setIntensity(0);
  };

  const toggleStop = async () => {
    if (stop) {
      const ok = await startMic();
      if (ok) {
        setStop(false);
      }
      return;
    }
    await haltMic();
  };

  useEffect(() => {
    try {
      audioRecorderPlayer.addRecordBackListener((e) => {
        const raw =
          typeof e.currentMetering === "number" ? e.currentMetering : -60;
        let db = raw;
        if (raw > 0) {
          db = 20 * Math.log10(Math.max(raw, 1) / 120);
        }
        const level = Math.max(0, Math.min(100, Math.round((db + 50) * 2)));
        setdBLevel(Math.round(db));
        setIntensity(level);
      });
    } catch {
      setMicError(MIC_ERROR_MESSAGES.unavailable);
      return undefined;
    }
    startMic()
      .then((ok) => {
        if (ok) {
          setStop(false);
        }
      })
      .catch(() => {
        setMicError(MIC_ERROR_MESSAGES["start-failed"]);
      });
    return () => {
      stopMicSession(() => audioRecorderPlayer.stopRecorder()).catch(() => {});
      try {
        audioRecorderPlayer.removeRecordBackListener();
      } catch {
        // Native recorder may be missing in a broken Release build.
      }
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
    setCurrentMode("sound");
    setMotorInput([1, intensity, intensity, intensity]);
  }, [intensity, setCurrentMode, setMotorInput, stop]);

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
        {micError ? <Text style={styles.micError}>{micError}</Text> : null}
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
  micError: {
    marginTop: 16,
    marginHorizontal: 24,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.small,
    textAlign: "center",
  },
});

export default SoundMeter;
