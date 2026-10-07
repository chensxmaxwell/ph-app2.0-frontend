/**
 * Legacy DeviceProvider. The hard-coded "Pleasure House" demo connect was
 * removed (Maxwell 2026-10-07): Bluetooth Connected means a real ICD-001 /
 * H11 session via the ICD-001 client. Stubs remain so older call sites that
 * still import useDevice() compile; connectDemo is a no-op.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  STORE_KEYS,
  scopedKey,
  subscribeSessionUser,
} from '../backend/session';
import { migrateLegacyStores } from '../backend/store';

import { stopToy } from './toy';

/** @deprecated Demo row removed; kept only so old imports compile. */
export const DEMO_DEVICE_ID = 'ph-demo';
/** @deprecated Demo row removed; kept only so old imports compile. */
export const DEMO_DEVICE_NAME = 'Pleasure House';

type DeviceContextValue = {
  /** Always false — demo connect is gone. */
  connected: boolean;
  connecting: boolean;
  name: string;
  battery: number;
  /** No-op. Real connects go through the ICD-001 client / Find page. */
  connectDemo: () => Promise<void>;
  disconnectDemo: () => void;
};

const DeviceContext = createContext<DeviceContextValue | null>(null);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [_userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSessionUser((user) => {
      const nextId = user?.id ?? null;
      setUserId(nextId);
      if (!nextId) {
        return;
      }
      // Clear any old persisted "demo connected" flag so a relaunch never
      // looks Connected without a real H11-/ICD1- session.
      migrateLegacyStores(nextId)
        .then(() =>
          AsyncStorage.setItem(
            scopedKey(STORE_KEYS.device, nextId),
            JSON.stringify({ connected: false })
          )
        )
        .catch(() => undefined);
    });
  }, []);

  const connectDemo = useCallback(async () => {
    // Removed: never fake a Bluetooth session.
  }, []);

  const disconnectDemo = useCallback(() => {
    stopToy();
  }, []);

  const value = useMemo(
    () => ({
      connected: false,
      connecting: false,
      name: DEMO_DEVICE_NAME,
      battery: 0,
      connectDemo,
      disconnectDemo,
    }),
    [connectDemo, disconnectDemo]
  );

  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within DeviceProvider');
  }
  return context;
};
