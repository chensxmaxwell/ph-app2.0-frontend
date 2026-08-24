import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import ChevronLeftfrom from "@images/chevron-left-white.svg";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import icons from "./icon-array";
import { SCREENS } from "@common/constant";
import { useCustomAlert } from "@common/util";
import { useAppContext } from "./kink-context";

const IconArray: Array<React.ElementType> = icons;

const SaveKinkScreen = () => {
  const navigation = useNavigation();
  const [kinkName, setKinkName] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<React.ElementType | null>(
    null
  );
  const [modalVisible, setModalVisible] = useState(false);
  const { showAlert, hideAlert } = useCustomAlert();

  const handleIconPress = (icon: React.ElementType) => {
    setSelectedIcon(() => icon);
    setKinkAvatar(icon);
    setkinkName(kinkName);
    setModalVisible(false);
  };

  const handleBackPress = () => {
    if (!isSaved) {
      showAlert({
        title: "Unsaved Changes",
        message:
          "You have unsaved changes. If you leave now, those changes will be lost. Would you like to save them before you go?",
        primaryButton: {
          text: "Save Changes",
          onPress: () => {
            setIsSaved(true);
          },
        },
        secondaryButton: {
          text: "Discard Changes",
          onPress: () => {
            navigation.goBack();
            hideAlert();
          },
        },
      });
    } else {
      navigation.goBack();
    }
  };

  const handleSavePress = () => {
    setIsSaved(true);
    navigation.navigate(SCREENS.KINK_CONFIRMATION);
  };

  const { setkinkName, setKinkAvatar } = useAppContext();

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
        <Text style={styles.headerTitle}>Save Kink</Text>
        <TouchableOpacity style={styles.backIcon} onPress={handleBackPress}>
          <ChevronLeftfrom width={35} height={35} />
        </TouchableOpacity>
      </View>

      <Text style={styles.iconLabel}>Kink Icon</Text>

      {/* Kink Icon Section */}
      <View style={styles.iconContainer}>
        <TouchableOpacity
          style={styles.iconCircle}
          onPress={() => setModalVisible(true)}
        >
          {selectedIcon
            ? React.createElement(selectedIcon, { width: 60, height: 60 })
            : null}
        </TouchableOpacity>
        <Text style={styles.iconText}>Choose an icon</Text>
      </View>

      {/* Kink Name Input */}
      <View style={styles.nameContainer}>
        <Text style={styles.labelText}>Kink Name</Text>
        <TextInput
          style={styles.input}
          value={kinkName}
          onChangeText={setKinkName}
        />
      </View>

      {/* Spacer to push buttons to the bottom */}
      <View style={{ flexGrow: 1 }} />

      {/* Continue Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSavePress}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>

      {/* Return Button */}
      <TouchableOpacity
        style={styles.returnButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.returnText}>Return</Text>
      </TouchableOpacity>

      {/* Icon Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={IconArray}
              keyExtractor={(item, index: number) => index.toString()}
              numColumns={5}
              renderItem={({ item }: { item: React.ElementType }) => {
                const IconComponent = item;
                return (
                  <TouchableOpacity
                    onPress={() => handleIconPress(item)}
                    style={styles.iconOption}
                  >
                    <IconComponent width={32} height={32} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    justifyContent: "flex-start",
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginBottom: 20,
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
  iconLabel: {
    paddingHorizontal: 32,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.medium2X,
  },
  iconContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  nameContainer: {
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.grayLightest,
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
  },
  labelText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.medium2X,
    marginBottom: 5,
  },
  input: {
    backgroundColor: colors.grayLightest,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.small,
    marginBottom: 30,
  },
  saveButton: {
    backgroundColor: colors.grayLightest,
    paddingVertical: 16,
    marginHorizontal: 32,
    borderRadius: 50,
  },
  saveText: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  returnButton: {
    backgroundColor: "transparent",
    paddingVertical: 16,
    marginHorizontal: 32,
    borderRadius: 50,
    marginBottom: 40,
    alignSelf: "center",
  },
  returnText: {
    color: colors.white,
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.grayLightSolid,
    paddingHorizontal: 32,
    paddingTop: 16,
    borderRadius: 21,
    width: 350,
    height: 470,
    marginTop: 190,
  },
  iconOption: {
    alignItems: "center",
    margin: 14,
  },
});

export default SaveKinkScreen;
