import React from "react";
import { Pressable } from "react-native";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { SCREENS } from "../src/common/constant";
import { leaveConnectDevice } from "../src/screens/onboarding/ConnectDevice/hooks";

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
    navigate: mockNavigate,
    getState: () => ({ index: 1 }),
  }),
  useRoute: () => ({ params: undefined }),
}));

jest.mock("../src/hooks/useBleManager", () => ({
  useBleManager: () => ({
    startScan: jest.fn(),
    scaning: false,
    stopScan: jest.fn(),
    bleState: undefined,
    checkBleState: jest.fn(),
    bleDevice: [],
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: false,
  }),
}));

jest.mock("../src/store/device", () => ({
  DEMO_DEVICE_ID: "ph-demo",
  DEMO_DEVICE_NAME: "Pleasure House",
  useDevice: () => ({
    connected: false,
    connecting: false,
    connectDemo: jest.fn(),
    disconnectDemo: jest.fn(),
    battery: 0,
  }),
}));

jest.mock("react-native-linear-gradient", () => "LinearGradient");
jest.mock("@images/icons/refresh-button.svg", () => "RefreshButton");
jest.mock("@images/icons/ble-connect.svg", () => "BleConnectIcon");
jest.mock("@images/icons/go-back.svg", () => "GoBackIcon");

describe("leaveConnectDevice", () => {
  beforeEach(() => {
    mockGoBack.mockReset();
    mockNavigate.mockReset();
  });

  it("pops when Find your device was pushed on top of Control or Playground", () => {
    leaveConnectDevice(
      {
        getState: () => ({ index: 1 }),
        canGoBack: () => true,
        goBack: mockGoBack,
        navigate: mockNavigate,
      },
      SCREENS.NAV_BAR
    );

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not pop the root stack when the BLE screen is the only route", () => {
    leaveConnectDevice(
      {
        getState: () => ({ index: 0 }),
        canGoBack: () => true,
        goBack: mockGoBack,
        navigate: mockNavigate,
      },
      SCREENS.NAV_BAR
    );

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(SCREENS.NAV_BAR);
  });
});

describe("ConnectDevice back chevron", () => {
  beforeEach(() => {
    mockGoBack.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockNavigate.mockReset();
  });

  it("is a real pressable, not a 12px SVG path, and tapping it pops", () => {
    const { ConnectDevice } = require("../src/screens/onboarding/ConnectDevice");
    const tree = renderer.create(React.createElement(ConnectDevice));
    const back = tree.root.findByProps({ accessibilityLabel: "Back" });

    expect(back.type).toBe(Pressable);
    expect(back.props.hitSlop).toBeTruthy();
    expect(back.props.onPress).toEqual(expect.any(Function));

    act(() => {
      back.props.onPress();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("lets the decorative gradient pass taps through so it cannot cover Back", () => {
    const { ConnectDevice } = require("../src/screens/onboarding/ConnectDevice");
    const tree = renderer.create(React.createElement(ConnectDevice));
    const gradient = tree.root.findByType("LinearGradient" as never);

    expect(gradient.props.pointerEvents).toBe("none");
  });
});
