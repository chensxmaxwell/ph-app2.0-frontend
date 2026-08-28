import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { colors } from "@common/styles/colors";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import LinearGradient from "react-native-linear-gradient";
import Xmark from "@images/xmark.svg";
import ChevronDownIcon from "@images/chevron-down-white.svg";
import ChevronUpIcon from "@images/chevron-up-white.svg";
import ChevronRight from "@images/chevron-right-white.svg";
import Pencil from "@images/Pencil.svg";
import TimePicker from "./TimePicker";
import { SCREENS } from "../../common/constant/index";
import { useCustomAlert } from "@common/util";
import {
  AlarmTime,
  addAlarm,
  defaultAlarmTime,
  getAlarmDraft,
  to24Hour,
} from "../../store/alarms";

const SetAlarmScreen = () => {
  const navigation = useNavigation();
  const { showAlert, hideAlert } = useCustomAlert();

  const [alarmName, setAlarmName] = useState("Alarm name");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [time, setTime] = useState<AlarmTime>(defaultAlarmTime);
  const [patternTitle, setPatternTitle] = useState(getAlarmDraft().patternTitle);

  useFocusEffect(
    useCallback(() => {
      setPatternTitle(getAlarmDraft().patternTitle);
    }, [])
  );

  const handlePencilPress = () => {
    setIsEditing(true);
  };

  const handleAlarmNameChange = (text: string) => {
    setAlarmName(text);
    setIsSaved(false);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleBackPress = () => {
    if (!isSaved) {
      showAlert({
        title: "Unsaved Changes",
        message:
          "You have unsaved changes. If you leave now, those changes will be lost.",
        primaryButton: {
          text: "Keep Setting",
          onPress: hideAlert,
        },
        secondaryButton: {
          text: "Discard Setting",
          onPress: () => {
            hideAlert();
            navigation.goBack();
          },
        },
      });
    } else {
      navigation.goBack();
    }
  };

  const handleSavePress = async () => {
    const clock = to24Hour(time);
    const draft = getAlarmDraft();
    await addAlarm({
      name: alarmName.trim() || "Alarm",
      hour: clock.hour,
      minute: clock.minute,
      days: selectedDays.filter(Boolean),
      patternTitle: draft.patternTitle,
      pattern: draft.pattern,
    });
    setPatternTitle(draft.patternTitle);
    setIsSaved(true);
    showAlert({
      title: "Changes Saved",
      message: "Your alarm settings have been saved.",
      primaryButton: {
        text: "OK",
        onPress: () => {
          hideAlert();
          navigation.reset({
            index: 1,
            routes: [
              { name: SCREENS.SETALARM_INTRO },
              { name: SCREENS.SETALARM_LIST },
            ],
          });
        },
      },
    });
  };

  const [repeatDays] = useState([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ]);
  const [selectedDays, setSelectedDays] = useState([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ]);

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((selected) => selected !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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

        {/* Header */}
        <View style={styles.header}>
          {!isEditing ? (
            <Text style={styles.headerTitle}>{alarmName}</Text>
          ) : (
            <TextInput
              style={styles.headerTitle}
              value={alarmName}
              onChangeText={handleAlarmNameChange}
              onBlur={handleBlur}
              autoFocus
            />
          )}
          <TouchableOpacity style={styles.backIcon} onPress={handleBackPress}>
            <Xmark width={35} height={35} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pencilIcon}
            onPress={handlePencilPress}
          >
            <Pencil width={35} height={35} />
          </TouchableOpacity>
        </View>

        {/* Time Picker */}
        <View style={styles.timePickerContainer}>
          <TimePicker value={time} onChange={setTime} />
        </View>

        {/* Repeat Section */}
        <View style={styles.repeatSection}>
          <View style={styles.dropDownSelection}>
            <Text style={styles.sectionTitle}>Repeat</Text>
            <TouchableOpacity onPress={toggleDropdown}>
              {!dropdownOpen && <ChevronDownIcon height={35} />}
              {dropdownOpen && <ChevronUpIcon height={35} />}
            </TouchableOpacity>
          </View>
          {!dropdownOpen && (
            <View style={styles.dayContainer}>
              {repeatDays.map((day, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(day) && styles.dayButtonSelected,
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      selectedDays.includes(day) &&
                        styles.dayButtonTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Pattern Section */}
        <View style={styles.patternSection}>
          <View style={styles.patternTextContainer}>
            <Text style={styles.sectionTitle}>Pattern</Text>
            <Text style={styles.patternText}>{patternTitle}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate(SCREENS.SETALARM_PATTERN)}
          >
            <ChevronRight width={35} height={35} style={styles.chevron} />
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSavePress}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
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
    left: 20,
    top: -5,
    width: 35,
    height: 35,
  },
  pencilIcon: {
    position: "absolute",
    left: 270,
    top: 0,
    width: 35,
    height: 35,
  },
  closeText: {
    fontSize: 24,
    color: "#FFFFFF",
  },
  editText: {
    fontSize: 24,
    color: "#FFFFFF",
  },
  timePickerContainer: {
    alignItems: "center",
    marginVertical: 30,
  },
  timeText: {
    fontSize: 50,
    color: "#FFFFFF",
  },
  repeatSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    marginBottom: 10,
  },
  dropDownSelection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dayButton: {
    backgroundColor: "#2B2358",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  dayButtonSelected: {
    backgroundColor: "#5B5BCF",
  },
  dayButtonText: {
    fontSize: fontSizes.medium,
    color: colors.white,
    fontFamily: "Quicksand-Regular",
  },
  dayButtonTextSelected: {
    color: colors.white,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Regular",
  },
  // Pattern Section
  patternSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  patternTextContainer: {
    justifyContent: "center",
  },
  patternText: {
    color: colors.grayLighter,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
  },
  chevron: {
    alignSelf: "center",
  },
  saveButtonContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 50,
  },
  saveButton: {
    backgroundColor: colors.grayLight,
    paddingVertical: 15,
    alignItems: "center",
    borderRadius: 50,
    marginVertical: 12,
    marginHorizontal: 32,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
  },
});

export default SetAlarmScreen;
