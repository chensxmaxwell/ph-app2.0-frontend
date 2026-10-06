/**
 * React binding for the advanced-control view-model.
 *
 *   const { view, ctl } = useAdvancedControl();
 *   view.cards / view.banner / view.screen ...; ctl.setWingValue('A', 60) ...
 *
 * Leaving the page (blur or unmount) releases control once per visit (blur +
 * unmount = once, audit F10): STOP on older firmware; on ICD001-1 auto keeps
 * running and a manual takeover is handed back with MODE AUTO (§11.6.3).
 * Focus re-arms it and hides the global "Auto on" pill. App background is
 * handled globally by useIcd001.
 * The last Pulse speed per device persists in AsyncStorage (§10.7, audit F4).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { setControlPageFocused, useIcd001 } from '../../services/icd001/useIcd001';

import { AdvancedControlController, AdvancedControlView } from './controller';
import { PLACEHOLDER_INFO } from './model';
import { createPulseSpeedStore } from './pulseMemory';

const pulseSpeedStore = createPulseSpeedStore(AsyncStorage);

export function useAdvancedControl(opts: { placeholderCards?: boolean } = {}): {
  view: AdvancedControlView;
  ctl: AdvancedControlController;
} {
  // client is re-created when switching BLE <-> mock
  const { client } = useIcd001();
  const placeholder = !!opts.placeholderCards;
  const ctl = useMemo(() => {
    const c = new AdvancedControlController(client, Date.now, pulseSpeedStore);
    // set before the first render so the cards don't pop in a frame later
    c.setPlaceholderInfo(placeholder ? PLACEHOLDER_INFO : null);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placeholder changes go through the effect below
  }, [client]);
  useEffect(() => {
    ctl.setPlaceholderInfo(placeholder ? PLACEHOLDER_INFO : null);
  }, [ctl, placeholder]);
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
      setControlPageFocused(true);
      return () => {
        setControlPageFocused(false);
        ctl.leave();
      };
    }, [ctl]),
  );
  const view = useSyncExternalStore(ctl.subscribe, ctl.getView);
  return { view, ctl };
}
