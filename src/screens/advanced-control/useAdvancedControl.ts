/**
 * React binding for the advanced-control view-model.
 *
 *   const { view, ctl } = useAdvancedControl();
 *   view.cards / view.banner / view.screen ...; ctl.setWingValue('A', 60) ...
 *
 * Leaving the page (blur or unmount) sends STOP (spec: "Leaving this page stops
 * all outputs"); app background -> STOP is installed globally by useIcd001.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { useIcd001 } from '../../services/icd001/useIcd001';

import { AdvancedControlController, AdvancedControlView } from './controller';

export function useAdvancedControl(): { view: AdvancedControlView; ctl: AdvancedControlController } {
  // client is re-created when switching BLE <-> mock
  const { client } = useIcd001();
  const ctl = useMemo(() => new AdvancedControlController(client), [client]);
  useEffect(() => {
    ctl.start();
    return () => {
      ctl.leave();
      ctl.dispose();
    };
  }, [ctl]);
  useFocusEffect(
    useCallback(() => {
      return () => ctl.leave();
    }, [ctl]),
  );
  const view = useSyncExternalStore(ctl.subscribe, ctl.getView);
  return { view, ctl };
}
