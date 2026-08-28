import React, { ReactNode, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@common/styles/colors";
import ChevronBack from "@images/avatar/chevron-back.svg";
import Xmark from "@images/avatar/xmark.svg";
import { s } from "./scale";
import {
  CREATE_STEPS,
  EDIT_LOOK_STEPS,
  EDIT_PERSONA_STEPS,
  WizardMode,
  WizardStepKey,
} from "./types";

export const GRADIENT_BASE = ["#2B2358", "#2B2358"] as const;
export const GRADIENT_OVERLAY = ["#5E5DBF", "rgba(50, 41, 105, 0)"] as const;

type HeaderIcon = "back" | "close" | "none";

export const WIZARD_PROGRESS_STEPS = 8;

export const wizardProgressFill = (step: number, total = WIZARD_PROGRESS_STEPS) =>
  Math.round((328 * step) / Math.max(1, total));

export const progressFor = (mode: WizardMode, key: WizardStepKey) => {
  const steps = stepsForMode(mode);
  const index = (steps as readonly string[]).indexOf(key);
  const step = index >= 0 ? index + 1 : 1;
  return wizardProgressFill(step, steps.length);
};

const stepsForMode = (mode: WizardMode) => {
  switch (mode) {
    case "create":
      return CREATE_STEPS;
    case "editLook":
      return EDIT_LOOK_STEPS;
    case "editPersona":
      return EDIT_PERSONA_STEPS;
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
};

type WizardShellProps = {
  title: string;
  titleFont?: "quicksand" | "opensans";
  progressFill?: number;
  leftIcon: HeaderIcon;
  rightIcon?: HeaderIcon;
  closeCircle?: boolean;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children: ReactNode;
};

const renderHeaderIcon = (icon: HeaderIcon) => {
  switch (icon) {
    case "back":
      return <ChevronBack width={s(35)} height={s(35)} />;
    case "close":
      return <Xmark width={s(35)} height={s(35)} />;
    case "none":
      return <View style={styles.headerIconPlaceholder} />;
    default: {
      const exhaustive: never = icon;
      return exhaustive;
    }
  }
};

const headerTitleStyle = (titleFont: "quicksand" | "opensans") => {
  switch (titleFont) {
    case "quicksand":
      return styles.headerTitle;
    case "opensans":
      return [styles.headerTitle, styles.headerTitleOpenSans];
    default: {
      const exhaustive: never = titleFont;
      return exhaustive;
    }
  }
};

export const WizardShell = ({
  title,
  titleFont = "quicksand",
  progressFill,
  leftIcon,
  rightIcon = "none",
  closeCircle = false,
  onLeftPress,
  onRightPress,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  children,
}: WizardShellProps) => (
  <View style={styles.root}>
    <LinearGradient
      colors={[...GRADIENT_BASE]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFillObject}
    />
    <LinearGradient
      colors={[...GRADIENT_OVERLAY]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onLeftPress}
          disabled={leftIcon === "none"}
          style={styles.headerSide}
          hitSlop={8}
        >
          {renderHeaderIcon(leftIcon)}
        </TouchableOpacity>
        <Text style={headerTitleStyle(titleFont)}>{title}</Text>
        <TouchableOpacity
          onPress={onRightPress}
          disabled={rightIcon === "none"}
          style={[
            styles.headerSide,
            closeCircle && rightIcon === "close" && styles.closeCircle,
          ]}
          hitSlop={8}
        >
          {renderHeaderIcon(rightIcon)}
        </TouchableOpacity>
      </View>
      {progressFill !== undefined && <ProgressBar fill={progressFill} />}
      <View style={styles.body}>{children}</View>
      {primaryLabel ? (
        <View
          style={[
            styles.footer,
            secondaryLabel ? styles.footerPair : styles.footerSingle,
          ]}
        >
          <PrimaryButton
            title={primaryLabel}
            onPress={onPrimary}
            disabled={primaryDisabled}
          />
          {secondaryLabel ? (
            <TouchableOpacity onPress={onSecondary} style={styles.returnHit}>
              <Text style={styles.returnText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  </View>
);

export const ProgressBar = ({ fill }: { fill: number }) => (
  <View style={styles.progressTrack}>
    <View
      style={[
        styles.progressFill,
        styles.progressGlow,
        { width: s(fill) },
      ]}
    />
    <View style={[styles.progressFill, { width: s(fill) }]} />
  </View>
);

export const PrimaryButton = ({
  title,
  onPress,
  width,
  disabled,
}: {
  title: string;
  onPress?: () => void;
  width?: number;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    onPress={disabled ? undefined : onPress}
    disabled={disabled}
    style={[
      styles.primaryButton,
      width ? { width: s(width) } : null,
      disabled ? styles.primaryButtonDisabled : null,
    ]}
    activeOpacity={0.85}
  >
    <Text style={styles.primaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

export const OptionPill = ({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[styles.optionPill, selected && styles.optionPillSelected]}
  >
    <Text style={styles.primaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

export const FieldLabel = ({ children }: { children: ReactNode }) => (
  <Text style={styles.fieldLabel}>{children}</Text>
);

export const FieldHint = ({ children }: { children: ReactNode }) => (
  <Text style={styles.fieldHint}>{children}</Text>
);

export const StepNote = ({ children }: { children: ReactNode }) => (
  <Text style={styles.stepNote}>{children}</Text>
);

export const PillField = ({
  children,
  focused,
  height,
}: {
  children: ReactNode;
  focused?: boolean;
  height?: number;
}) => (
  <View
    style={[
      styles.pillField,
      focused && styles.pillFieldFocused,
      height ? { height: s(height) } : null,
    ]}
  >
    {children}
  </View>
);

export const UnsavedChangesModal = ({
  visible,
  onKeep,
  onDiscard,
}: {
  visible: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}) => (
  <Modal transparent animationType="fade" visible={visible}>
    <View style={styles.modalOverlay}>
      <View style={styles.unsavedCard}>
        <Text style={styles.unsavedTitle}>Unsaved Changes</Text>
        <Text style={styles.unsavedMessage}>
          You have unsaved changes. If you leave now, those changes will be
          lost.{" "}
        </Text>
        <PrimaryButton title="Keep Creating" onPress={onKeep} width={233} />
        <TouchableOpacity onPress={onDiscard} style={styles.discardHit}>
          <Text style={styles.discardText}>Discard Creation</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

export const useLeaveGuard = (isDirty: boolean, onDiscard: () => void) => {
  const [visible, setVisible] = useState(false);

  const requestLeave = () => {
    if (isDirty) {
      setVisible(true);
      return;
    }
    onDiscard();
  };

  return {
    requestLeave,
    modal: (
      <UnsavedChangesModal
        visible={visible}
        onKeep={() => setVisible(false)}
        onDiscard={() => {
          setVisible(false);
          onDiscard();
        }}
      />
    ),
  };
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#2B2358",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    minHeight: s(50),
    marginTop: s(8),
    paddingHorizontal: s(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: {
    width: s(35),
    height: s(35),
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconPlaceholder: {
    width: s(35),
    height: s(35),
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
  },
  headerTitleOpenSans: {
    fontFamily: "OpenSans-Bold",
  },
  closeCircle: {
    width: s(50),
    height: s(50),
    borderRadius: s(25),
    backgroundColor: colors.grayLightest,
  },
  progressTrack: {
    marginTop: s(23),
    alignSelf: "center",
    width: s(328),
    height: s(10),
    borderRadius: s(20),
    backgroundColor: colors.grayLightest,
    overflow: "visible",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: s(10),
    borderRadius: s(20),
    backgroundColor: colors.accentLightPink,
  },
  progressGlow: {
    shadowColor: colors.accentLightPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  body: {
    flex: 1,
    overflow: "hidden",
  },
  footer: {
    alignItems: "center",
    paddingTop: s(8),
  },
  footerSingle: {
    paddingBottom: s(24),
  },
  footerPair: {
    paddingBottom: s(18),
  },
  primaryButton: {
    width: s(297),
    height: s(50),
    borderRadius: s(50),
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  returnHit: {
    marginTop: s(15),
    minHeight: s(23),
    justifyContent: "center",
  },
  returnText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  optionPill: {
    width: s(297),
    height: s(50),
    borderRadius: s(50),
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionPillSelected: {
    backgroundColor: colors.grayLighter,
    borderColor: colors.white,
  },
  fieldLabel: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  fieldHint: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    lineHeight: 16.25,
    textAlign: "center",
    width: s(329),
    alignSelf: "center",
  },
  stepNote: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center",
    width: s(329),
    alignSelf: "center",
    marginBottom: s(8),
  },
  pillField: {
    width: s(329),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: colors.grayLightest,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: s(16),
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillFieldFocused: {
    borderColor: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  unsavedCard: {
    width: s(321),
    height: s(290),
    borderRadius: s(20),
    backgroundColor: "rgba(33, 33, 33, 0.85)",
    alignItems: "center",
    paddingTop: s(50),
    paddingHorizontal: s(24),
  },
  unsavedTitle: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  unsavedMessage: {
    marginTop: s(12),
    marginBottom: s(28),
    width: s(239),
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    lineHeight: 16.25,
    textAlign: "center",
  },
  discardHit: {
    marginTop: s(12),
    minHeight: s(23),
    justifyContent: "center",
  },
  discardText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    textAlign: "center",
  },
});
