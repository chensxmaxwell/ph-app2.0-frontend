/**
 * Home / Control connection pill — same ICD-001 session as Find, Manual,
 * Advanced and the Auto bar. Never the old demo "Pleasure House" fake link.
 */
import { useNavigation } from '@react-navigation/native';

import { linkViewFromState, useIcd001 } from "../../../services/icd001";
import { SCREENS } from "../../constant";

export const useConnectionPill = () => {
  const { state } = useIcd001();
  const link = linkViewFromState(state);
  const navigation = useNavigation();

  const toggleDevice = () => {
    navigation.navigate(SCREENS.CONNECT_DEVICE as never);
  };

  return {
    connectStatus: link.connected,
    connecting: link.connecting,
    battery: link.batteryPct,
    label: link.label,
    batteryText: link.batteryText,
    toggleDevice,
  };
};
