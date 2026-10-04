/**
 * React binding for the advanced-control view-model.
 *
 *   const { view, ctl } = useAdvancedControl();
 *   view.cards / view.banner / view.screen ...; ctl.setWingValue('A', 60) ...
 *
 * Leaving the page (blur or unmount) sends STOP once per visit (spec: "Leaving
 * this page stops all outputs"; blur + unmount = one STOP, audit F10); focus
 * re-arms it. App background -> STOP is installed globally by useIcd001.
 * The last Pulse speed per device persists in AsyncStorage (§10.7, audit F4).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { useIcd001 } from '../../services/icd001/useIcd001';

import { AdvancedControlController, AdvancedControlView } from './controller';
import { createPulseSpeedStore } from './pulseMemory';

const pulseSpeedStore = createPulseSpeedStore(AsyncStorage);

export function useAdvancedControl(): { view: AdvancedControlView; ctl: AdvancedControlController } {
  // client is re-created when switching BLE <-> mock
  const { client } = useIcd001();
  const ctl = useMemo(() => new AdvancedControlController(client, Date.now, pulseSpeedStore), [client]);
  useEffect(() => {
    ctl.start();
    return () => {
      ctl.leave();
      ctl.dispose();
    };
  }, [ctl]);
  useFocusEffect(
    useCallback(() => {
      ctl.enter();
      return () => ctl.leave();
    }, [ctl]),
  );
  const view = useSyncExternalStore(ctl.subscribe, ctl.getView);
  return { view, ctl };
}
