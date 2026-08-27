import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storageKeyForUser, subscribeSessionUser } from "../backend/session";
import { migrateLegacyDeviceOnce } from "../backend/store";
import { stopToy } from "./toy";
export const DEMO_DEVICE_ID = "ph-demo";
export const DEMO_DEVICE_NAME = "Pleasure House";

type DeviceContextValue = {
  connected: boolean;
  connecting: boolean;
  name: string;
  battery: number;
  connectDemo: () => Promise<void>;
  disconnectDemo: () => void;
};

const DeviceContext = createContext<DeviceContextValue | null>(null);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSessionUser((user) => {
      const nextId = user?.id ?? "anon";
      setUserId(nextId);
      setHydrated(false);
      migrateLegacyDeviceOnce(nextId)
        .then(() => AsyncStorage.getItem(storageKeyForUser(nextId, "device")))
        .then((raw) => {
          if (!raw) {
            setConnected(false);
            return;
          }
          const parsed = JSON.parse(raw) as { connected?: boolean };
          setConnected(!!parsed.connected);
        })
        .catch(() => setConnected(false))
        .finally(() => setHydrated(true));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated || !userId) {
      return;
    }
    AsyncStorage.setItem(
      storageKeyForUser(userId, "device"),
      JSON.stringify({ connected })
    ).catch(() => undefined);
  }, [connected, hydrated, userId]);

  const connectDemo = useCallback(async () => {
    if (connected) {
      return;
    }
    setConnecting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setConnected(true);
    setConnecting(false);
  }, [connected]);

  const disconnectDemo = useCallback(() => {
    stopToy();
    setConnecting(false);
    setConnected(false);
  }, []);

  const value = useMemo(
    () => ({
      connected,
      connecting,
      name: DEMO_DEVICE_NAME,
      battery: 100,
      connectDemo,
      disconnectDemo,
    }),
    [connectDemo, connected, connecting, disconnectDemo]
  );

  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error("useDevice must be used within DeviceProvider");
  }
  return context;
};
