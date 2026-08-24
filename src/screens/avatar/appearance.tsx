import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { SCREENS } from "@common/constant";
import {
  APPEARANCE_COUNT,
  applyCharacterPreset,
  lookFromDraft,
  useAvatarWizard,
} from "./context";
import { FittedAvatarPreview } from "./engine/AvatarPreview";
import { OutfitCard, toOutfitIndex } from "./outfit-card";
import { s } from "./scale";
import { WizardShell, useLeaveGuard } from "./shared";

export const AvatarAppearanceScreen = () => {
  const navigation = useNavigation();
  const { draft, patchDraft, resetDraft, isDirty } = useAvatarWizard();
  const { requestLeave, modal } = useLeaveGuard(isDirty, () => {
    resetDraft();
    navigation.getParent()?.goBack();
  });
  const title = draft.name.trim() || "[Name]";

  return (
    <WizardShell
      title={title}
      titleFont="opensans"
      leftIcon="none"
      rightIcon="close"
      closeCircle
      onRightPress={requestLeave}
      primaryLabel="Continue"
      onPrimary={() => navigation.navigate(SCREENS.AVATAR_CUSTOMIZE)}
    >
      {modal}
      <View style={styles.content}>
        <FittedAvatarPreview look={lookFromDraft(draft)} aspect={226 / 489} />
        <View style={styles.thumbs}>
          {Array.from({ length: APPEARANCE_COUNT }).map((_, index) => {
            const selected = draft.appearanceIndex === index;
            const outfit = toOutfitIndex(index);
            return (
              <View
                key={index}
                style={[styles.thumbWrap, selected && styles.thumbWrapSelected]}
              >
                <TouchableOpacity
                  onPress={() => patchDraft(applyCharacterPreset(index))}
                  style={[styles.thumb, selected && styles.thumbSelected]}
                  activeOpacity={0.85}
                >
                  <OutfitCard outfit={outfit} selected={selected} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    </WizardShell>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
  },
  thumbs: {
    marginTop: s(8),
    marginBottom: s(8),
    width: s(345),
    flexDirection: "row",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  thumbWrap: {
    width: s(82),
    height: s(82),
    borderRadius: s(16),
  },
  thumbWrapSelected: {
    shadowColor: colors.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 7,
  },
  thumb: {
    width: s(82),
    height: s(82),
    borderRadius: s(16),
    overflow: "hidden",
    backgroundColor: "rgba(43, 35, 88, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(243, 243, 243, 0.18)",
  },
  thumbSelected: {
    borderWidth: 2.5,
    borderColor: colors.white,
    backgroundColor: "rgba(243, 243, 243, 0.28)",
  },
});
