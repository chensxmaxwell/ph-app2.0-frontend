/**
 * React binding for the ICD-001 client.
 *
 *   const { state, client } = useIcd001();
 *   useIcd001SafetyStop();   // on the advanced-control page: STOP on blur/unmount
 *
 * App background / foreground is installed globally the first time the hook
 * mounts: older firmware -> STOP (§5); ICD001-1 -> release control (auto keeps
 * running, a manual takeover is handed back with MODE AUTO, §11.6.3) and
 * RATE 2 while in the background, RATE 10 back in the foreground.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { BleIcd001Transport } from './bleTransport';
import { Icd001Client, Icd001State } from './client';
import { MockIcd001Transport } from './mock';

export type Icd001Mode = 'ble' | 'mock';

let client: Icd001Client | null = null;
let mode: Icd001Mode = 'ble';
const modeListeners = new Set<() => void>();
let appStateSub: { remove: () => void } | null = null;

function ensureAppStateHook(): void {
  if (appStateSub) {
    return;
  }
  appStateSub = AppState.addEventListener('change', next => {
    if (next === 'background') {
      client?.onAppBackground();
    } else if (next === 'active') {
      client?.onAppForeground();
    }
  });
}

export function getIcd001Client(): Icd001Client {
  if (!client) {
    client = new Icd001Client(mode === 'mock' ? new MockIcd001Transport() : new BleIcd001Transport());
  }
  ensureAppStateHook();
  return client;
}

export function getIcd001Mode(): Icd001Mode {
  return mode;
}

/** Switch between real BLE and the simulator. Disconnects the current session. */
export async function setIcd001Mode(next: Icd001Mode): Promise<void> {
  if (next === mode && client) {
    return;
  }
  const old = client;
  client = null;
  mode = next;
  if (old) {
    await old.disconnect().catch(() => undefined);
    old.destroy();
  }
  modeListeners.forEach(l => l());
}

function subscribeMode(cb: () => void): () => void {
  modeListeners.add(cb);
  return () => {
    modeListeners.delete(cb);
  };
}

export function useIcd001(): {
  state: Icd001State;
  client: Icd001Client;
  mode: Icd001Mode;
} {
  const currentMode = useSyncExternalStore(subscribeMode, getIcd001Mode);
  const c = getIcd001Client();
  const subscribe = useCallback((cb: () => void) => c.subscribe(cb), [c]);
  const state = useSyncExternalStore(subscribe, c.getState);
  return { state, client: c, mode: currentMode };
}

/**
 * Put on any screen that drives actuators: sends STOP when the screen loses
 * focus (navigating away) or unmounts.
 */
export function useIcd001SafetyStop(): void {
  useFocusEffect(
    useCallback(() => {
      return () => getIcd001Client().stopForSafety('leave page');
    }, []),
  );
  useEffect(() => () => getIcd001Client().stopForSafety('unmount'), []);
}

// ------------------------------------------------------------ control-page focus

/**
 * How many ICD-001 control pages (Manual / Advanced control) are focused. The
 * global "Auto on" pill shows only when none is (it lives on every other page).
 */
let controlFocus = 0;
const focusListeners = new Set<() => void>();

export function setControlPageFocused(on: boolean): void {
  controlFocus = Math.max(0, controlFocus + (on ? 1 : -1));
  focusListeners.forEach(l => l());
}

export function isControlPageFocused(): boolean {
  return controlFocus > 0;
}

export function useControlPageFocused(): boolean {
  return useSyncExternalStore(
    useCallback((cb: () => void) => {
      focusListeners.add(cb);
      return () => {
        focusListeners.delete(cb);
      };
    }, []),
    isControlPageFocused,
  );
}
