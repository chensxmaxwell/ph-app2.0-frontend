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
import { stopToy } from "./toy";

const STORAGE_KEY = "ph.device.v1";
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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as { connected?: boolean };
        if (parsed.connected) {
          setConnected(true);
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ connected })
    ).catch(() => undefined);
  }, [connected, hydrated]);

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
