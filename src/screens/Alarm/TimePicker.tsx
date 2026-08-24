import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@common/styles/colors";
import { Picker } from "@react-native-picker/picker";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { AlarmTime } from "../../store/alarms";

type TimePickerProps = {
  value: AlarmTime;
  onChange: (next: AlarmTime) => void;
};

const TimePicker = ({ value, onChange }: TimePickerProps) => {
  const hours = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0")
  );
  const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  const ampm: AlarmTime["ampm"][] = ["AM", "PM"];

  return (
    <View style={styles.container}>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={value.hour}
          style={styles.picker}
          itemStyle={{
            fontSize: fontSizes.medium2X,
            fontFamily: "Quicksand-Bold",
            fontWeight: fontWeights.bold,
            color: colors.white,
          }}
          onValueChange={(hour) => onChange({ ...value, hour })}
        >
          {hours.map((hour) => (
            <Picker.Item key={hour} label={hour} value={hour} />
          ))}
        </Picker>

        <Text style={styles.separator}>:</Text>

        <Picker
          selectedValue={value.minute}
          style={styles.picker}
          itemStyle={{
            fontSize: fontSizes.medium2X,
            fontFamily: "Quicksand-Bold",
            fontWeight: fontWeights.bold,
            color: colors.white,
          }}
          onValueChange={(minute) => onChange({ ...value, minute })}
        >
          {minutes.map((minute) => (
            <Picker.Item key={minute} label={minute} value={minute} />
          ))}
        </Picker>

        <Picker
          selectedValue={value.ampm}
          style={styles.picker}
          itemStyle={{
            fontSize: fontSizes.medium2X,
            fontFamily: "Quicksand-Bold",
            fontWeight: fontWeights.bold,
            color: colors.white,
          }}
          onValueChange={(next) =>
            onChange({ ...value, ampm: next as AlarmTime["ampm"] })
          }
        >
          {ampm.map((label) => (
            <Picker.Item key={label} label={label} value={label} />
          ))}
        </Picker>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  picker: {
    width: 100,
    height: 200,
    color: "blue",
  },
  separator: {
    fontSize: fontSizes.largeX,
    fontWeight: fontWeights.bold,
    fontFamily: "Oxygen-Bold",
    color: colors.white,
  },
});

export default TimePicker;
