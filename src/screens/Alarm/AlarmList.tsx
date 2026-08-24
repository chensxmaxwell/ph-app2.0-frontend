import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import {
  Swipeable,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import LinearGradient from "react-native-linear-gradient";
import Xmark from "@images/xmark.svg";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  SavedAlarm,
  formatAlarmTime,
  loadAlarms,
  removeAlarm,
  updateAlarm,
} from "../../store/alarms";

const remainingLabel = (alarm: SavedAlarm) => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(alarm.hour, alarm.minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  const minutes = Math.max(1, Math.round((next.getTime() - now.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
};

const AlarmList = () => {
  const navigation = useNavigation();
  const [alarms, setAlarms] = useState<SavedAlarm[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadAlarms().then(setAlarms);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const renderRightActions = (id: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={async () => {
          await removeAlarm(id);
          refresh();
        }}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
        ></LinearGradient>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Set Alarm</Text>
          <TouchableOpacity
            style={styles.backIcon}
            onPress={() => navigation.goBack()}
          >
            <Xmark width={35} height={35} />
          </TouchableOpacity>
        </View>

        <View style={styles.alarmListContainer}>
          {alarms.length === 0 ? (
            <Text style={styles.empty}>No alarms yet. Save one to play a pattern when it fires.</Text>
          ) : null}
          {alarms.map((alarm) => (
            <Swipeable
              key={alarm.id}
              renderRightActions={() => renderRightActions(alarm.id)}
              onSwipeableWillOpen={() => setOpenId(alarm.id)}
              onSwipeableWillClose={() =>
                setOpenId((current) => (current === alarm.id ? null : current))
              }
              overshootLeft={true}
            >
              <View
                style={[
                  styles.card,
                  openId === alarm.id ? styles.cardSwipedOpen : null,
                  alarm.enabled === false ? styles.cardSwitchOff : null,
                ]}
              >
                <Text
                  style={[
                    styles.AlarmTitle,
                    alarm.enabled === false ? styles.textSwitchOff : null,
                  ]}
                >
                  {alarm.name}
                </Text>
                <Text
                  style={[
                    styles.alarmTime,
                    alarm.enabled === false ? styles.textSwitchOff : null,
                  ]}
                >
                  {formatAlarmTime(alarm.hour, alarm.minute)}
                </Text>
                <View style={styles.textRow}>
                  <Text
                    style={[
                      styles.days,
                      alarm.enabled === false ? styles.textSwitchOff : null,
                    ]}
                  >
                    {alarm.days.filter(Boolean).join(", ") || "Every day"}
                  </Text>
                  <Text
                    style={[
                      styles.timeLeft,
                      alarm.enabled === false ? styles.textSwitchOff : null,
                    ]}
                  >
                    {remainingLabel(alarm)}
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: "#FFFFF", true: "#5E5DBF" }}
                  thumbColor={alarm.enabled ? "#FFFFFF" : "#f4f3f4"}
                  ios_backgroundColor={colors.grayLighter}
                  onValueChange={async () => {
                    await updateAlarm(alarm.id, { enabled: !alarm.enabled });
                    refresh();
                  }}
                  value={alarm.enabled}
                  style={styles.switch}
                />
              </View>
            </Swipeable>
          ))}
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 60,
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
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
    left: 0,
    top: 0,
    width: 35,
    height: 35,
  },
  alarmListContainer: {
    marginTop: 30,
  },
  empty: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#2b2358",
    width: "100%",
    height: 143,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    justifyContent: "space-between",
    position: "relative",
  },
  cardSwipedOpen: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardSwitchOff: {
    backgroundColor: colors.grayLightest,
  },
  AlarmTitle: {
    fontSize: fontSizes.medium,
    color: colors.white,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  alarmTime: {
    fontSize: 40,
    color: colors.white,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  textRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  days: {
    color: colors.white,
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
  },
  timeLeft: {
    color: colors.white,
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
  },
  textSwitchOff: {
    color: "#c7c4c4",
  },
  actionContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 100,
    height: "100%",
  },
  deleteButton: {
    backgroundColor: "#f95f6e",
    justifyContent: "center",
    alignItems: "center",
    width: 100,
    height: 143,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  deleteText: {
    color: colors.white,
    fontWeight: "bold",
    fontSize: fontSizes.small,
    fontFamily: "OpenSans-SemiBold",
  },
  switch: {
    position: "absolute",
    right: 16,
    top: 16,
  },
});

export default AlarmList;
