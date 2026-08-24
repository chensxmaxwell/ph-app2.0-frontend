import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import ChevronDownIcon from "@images/chevron-down-white.svg";
import ChevronUpIcon from "@images/chevron-up-white.svg";
import { useNavigation } from "@react-navigation/native";
import ChevronLeft from "@images/chevron-left-white.svg";
import EditIcon from "@images/editIcon.svg";
import { useProfile } from "./hooks";
import { useCustomAlert } from "@common/util";

const EditProfileScreen = () => {
  const { profile, setProfile, updateProfile, isValidDate } = useProfile();

  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState(profile.gender);
  const [birthday, setBirthday] = useState(profile.birthday);
  const navigation = useNavigation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const genderOptions = ["Female", "Male", "Non-binary"];
  const [birthdayOpacity, setbirthdayOpacity] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [nameEditable, setnameEditable] = useState(false);

  const { showAlert, hideAlert } = useCustomAlert();

  useEffect(() => {
    setName(profile.name);
    setBirthday(profile.birthday);
  }, [profile]);

  const handleImageUpload = () => {
    // 实现上传图片的功能
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
    setbirthdayOpacity((prevOpacity) => (prevOpacity === 1 ? 0 : 1));
  };

  const selectOption = (option: string) => {
    setGender(option);
    setDropdownOpen(false);
    setbirthdayOpacity(1);
  };

  const toggleNameEditable = () => {
    setnameEditable(!nameEditable);
  };

  const handleBackPress = () => {
    if (isSaving) {
      showAlert({
        title: "Error",
        message: "Profile is being updated...",
        primaryButton: {
          text: "OK",
          onPress: hideAlert,
        },
      });
    } else {
      navigation.goBack();
    }
  };

  const handleSaveButton = async () => {
    if (!isValidDate(birthday)) {
      showAlert({
        title: "Invalid Date",
        message: "Please enter a valid date in DD/MM/YYYY format",
        primaryButton: {
          text: "OK",
          onPress: hideAlert,
        },
      });
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({ name, birthday });
      setProfile((prevProfile) => ({
        ...prevProfile,
        name: name,
        birthday: birthday,
      }));
      showAlert({
        title: "Success",
        message: "Profile updated successfully.",
        primaryButton: {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      });
    } catch (error) {
      showAlert({
        title: "Error",
        message: "Failed to update profile.",
        primaryButton: {
          text: "OK",
          onPress: hideAlert,
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <TouchableOpacity style={styles.backIcon} onPress={handleBackPress}>
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Profile Image Section */}
        <View style={styles.profileImageContainer}>
          <TouchableOpacity onPress={handleImageUpload}>
            <View style={styles.profileImage}>{/* 默认显示的圆形 */}</View>
          </TouchableOpacity>
          <Text style={styles.uploadText}>Upload an image</Text>
        </View>

        {/* Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Name</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.grayLightest}
              value={name}
              onChangeText={setName}
              editable={nameEditable}
              maxLength={30}
            />
            <TouchableOpacity onPress={toggleNameEditable}>
              <EditIcon width={35} height={35} style={styles.icon} />
            </TouchableOpacity>
          </View>

          {/* Gender Dropdown */}
          <View style={{ zIndex: 999 }}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity
              style={styles.pickerContainer}
              onPress={toggleDropdown}
            >
              {!dropdownOpen && <ChevronDownIcon height={35} />}
              {dropdownOpen && <ChevronUpIcon height={35} />}
              <Text style={styles.pickerText}>{gender}</Text>
            </TouchableOpacity>

            {/* Dropdown Options */}
            {dropdownOpen && (
              <View style={styles.dropdown}>
                {genderOptions.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dropdownOption,
                      index === genderOptions.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                    onPress={() => selectOption(option)}
                  >
                    <Text style={styles.dropdownOptionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Birthday Input */}
          <View style={{ zIndex: 99, opacity: birthdayOpacity }}>
            <Text style={styles.label}>Birthday</Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={styles.input}
                placeholder="mm/dd/yyyy"
                placeholderTextColor={colors.grayLightest}
                value={birthday}
                onChangeText={setBirthday}
              />
            </View>
          </View>
        </View>

        {/* Save and Cancel Buttons */}
        <View style={{ marginBottom: 30 }}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveButton}
          >
            <Text style={styles.saveButtonText}>Save changes</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBackPress}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  // Header Section
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
  backIcon: {
    width: 35,
    height: 35,
  },
  container: {
    flex: 1,
    width: "100%",
    justifyContent: "space-around",
  },
  // Profile Image Section
  profileImageContainer: {
    alignItems: "center",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.grayLight,
    marginBottom: 10,
  },
  uploadText: {
    fontSize: fontSizes.small,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    textAlign: "center",
    height: 23,
  },
  // Input Section
  inputSection: {},
  label: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    marginVertical: 10,
    zIndex: 1,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.grayLight,
    borderRadius: 25,
    paddingHorizontal: 8,
    height: 40,
  },
  input: {
    paddingLeft: 8,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
  },
  icon: {
    marginRight: 0,
  },
  pickerContainer: {
    backgroundColor: colors.grayLight,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 20,
    height: 40,
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
  },
  pickerText: {
    color: colors.grayLighter,
    fontSize: fontSizes.small,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    flex: 1,
    textAlign: "left",
    paddingLeft: 8,
    position: "relative",
  },
  // Dropdown menu styles
  dropdown: {
    backgroundColor: colors.grayLightest,
    borderRadius: 10,
    width: "100%",
    position: "absolute",
    top: 100,
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLighter,
    borderStyle: "solid",
  },
  dropdownOptionText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
    textAlign: "center",
  },
  // Button Section
  saveButton: {
    backgroundColor: colors.grayLightest,
    borderRadius: 50,
    height: 50,
    paddingVertical: 10,
    marginBottom: 10,
    alignItems: "center",
    marginHorizontal: 16,
  },
  saveButtonText: {
    fontSize: fontSizes.medium2X,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
  },
  cancelText: {
    fontSize: fontSizes.small,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
});

export default EditProfileScreen;
