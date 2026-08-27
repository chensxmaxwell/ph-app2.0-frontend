import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
// @ts-ignore
import WaveView from "react-native-waveview";
import ChevronLeftfrom from "@images/chevron-left-white.svg";
import LightBulb from "@images/lightbulb.svg";
import MotionCupIcon from "@images/motion-cup-icon.svg";
import {
  accelerometer,
  setUpdateIntervalForType,
  SensorTypes,
} from "react-native-sensors";
import { SCREENS } from "../../common/constant/index";
import { useHomeScreen } from "../../hooks/HomeScreenContext";

const MotionSensorScreen = () => {
  const navigation = useNavigation();
  const [amplitude, setAmplitude] = useState(0);
  const waveRef = useRef(null);

  const { setCurrentMode, motor_selection_table, setMotorInput } =
    useHomeScreen();

  useEffect(() => {
    setUpdateIntervalForType(SensorTypes.accelerometer, 50);
    let gx = 0;
    let gy = 0;
    let gz = 0;
    let primed = false;
    const subscription = accelerometer.subscribe(
      ({ x, y, z }) => {
        if (!primed) {
          gx = x;
          gy = y;
          gz = z;
          primed = true;
        } else {
          const alpha = 0.85;
          gx = alpha * gx + (1 - alpha) * x;
          gy = alpha * gy + (1 - alpha) * y;
          gz = alpha * gz + (1 - alpha) * z;
        }
        const linear = Math.sqrt(
          (x - gx) * (x - gx) + (y - gy) * (y - gy) + (z - gz) * (z - gz)
        );
        const next = Math.max(0, Math.min(100, Math.round(linear * 55)));
        setAmplitude(next);
        if (waveRef.current) {
          const waveH =
            next < 12 ? 20 : next < 28 ? 65 : next < 48 ? 110 : next < 72 ? 155 : 200;
          // @ts-ignore
          waveRef.current.setWaveParams([{ A: waveH, T: 360, fill: "#CCA0DD" }]);
        }
      },
      () => {
        setAmplitude(0);
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      setCurrentMode("");
      setMotorInput([]);
    };
  }, [setCurrentMode, setMotorInput]);

  useEffect(() => {
    setCurrentMode("motion");
    const level =
      amplitude < 12
        ? 0
        : amplitude < 22
        ? 25
        : amplitude < 32
        ? 50
        : amplitude < 42
        ? 75
        : 100;
    setMotorInput([1, level, level, level]);
  }, [amplitude, setCurrentMode, setMotorInput]);

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
        <Text style={styles.headerTitle}>Motion Sensor</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftfrom width={35} height={35} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.lightbulbIcon}
          onPress={() => {
            console.log("LightBulb pressed");
            navigation.navigate(SCREENS.MOTION_INTRODUCTION);
          }}
        >
          <LightBulb width={35} height={35} />
        </TouchableOpacity>
      </View>

      <View style={styles.waveContainer}>
        <WaveView
          ref={waveRef}
          style={styles.wave}
          H={100}
          waveParams={[{ A: 20, T: 180, fill: "#CCA0DD" }]}
          animated={true}
        />
        <LinearGradient
          colors={["#CCA0DD", "#5E5DBF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.gradientOverlay]}
        />
        <MotionCupIcon style={styles.cupIcon} />
        <Text style={styles.text}>
          Shake your phone to {"\n"}control the device
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    justifyContent: "space-between",
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginBottom: 20,
    zIndex: 2,
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
  waveContainer: {
    height: 600,
    position: "relative",
    zIndex: 1,
  },
  wave: {
    width: "100%",
    height: "100%",
    position: "absolute",
    bottom: 500,
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    height: 500,
    width: "100%",
  },
  cupIcon: {
    position: "absolute",
    bottom: 200,
    left: 120,
  },
  text: {
    position: "absolute",
    bottom: 130,
    left: 100,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    textAlign: "center",
  },
  test: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    color: colors.white,
    textAlign: "center",
  },
});

export default MotionSensorScreen;
