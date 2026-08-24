import React, { useContext } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { GlobalContext } from "../../../store";
import { colors } from "@common/styles/colors";
import { PillButton } from "../pill-button";
import { fontSizes, fontWeights } from "@common/styles/fonts";

export const CustomAlert: React.FC = () => {
  const { globalState, setGlobalState } = useContext(GlobalContext);
  const {
    visible,
    title,
    message,
    content,
    primaryButton,
    secondaryButton,
    cancelable,
  } = globalState.popup;
  const handleClose = () => {
    setGlobalState((prevState) => ({
      ...prevState,
      popup: {
        ...prevState.popup,
        visible: false,
      },
    }));
  };
  const defaultPrimaryButton = (primaryButton && {
    ...primaryButton,
    onPress: () => {
      primaryButton.onPress();
      handleClose();
    },
  }) || {
    text: "OK",
    onPress: handleClose,
  };

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      onRequestClose={cancelable ? handleClose : undefined} // Use cancelable
    >
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          {content ? (
            content
          ) : (
            <View>
              {title && <Text style={styles.title}>{title}</Text>}
              {message && <Text style={styles.message}>{message}</Text>}
            </View>
          )}
          <View style={styles.buttonContianer}>
            <PillButton
              style={styles.primaryButton}
              onPress={defaultPrimaryButton.onPress}
            >
              <Text style={styles.primaryButtonText}>
                {defaultPrimaryButton.text}
              </Text>
            </PillButton>
            {secondaryButton && (
              <TouchableOpacity
                onPress={secondaryButton.onPress}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  {secondaryButton.text}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertBox: {
    width: 300,
    padding: 20,
    backgroundColor: colors.alertGray,
    borderRadius: 10,
    alignItems: "center",
    paddingBottom: 30,
    paddingTop: 34,
    paddingLeft: 22,
    paddingRight: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: colors.white,
  },
  message: {
    color: colors.grayLighter,
  },
  buttonContianer: {
    flexDirection: "column",
    marginTop: 47,
  },
  primaryButton: {
    borderColor: "transparent",
    backgroundColor: colors.grayLightest,
    width: 233,
  },
  primaryButtonText: {
    color: colors.white,
    alignSelf: "center",
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.medium2X,
  },
  secondaryButton: {
    padding: 10,
    alignSelf: "center",
  },
  secondaryButtonText: {
    color: colors.white,
  },
});
