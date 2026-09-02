import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { Vibration } from "react-native";
import {
  applyToyMotor,
  getToyIntensity,
  motorLevel,
  stopToy,
} from "../src/store/toy";

describe("demo toy motor state", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    stopToy();
  });

  afterEach(() => {
    stopToy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("normalizes motor command intensity", () => {
    expect(motorLevel()).toBe(0);
    expect(motorLevel([])).toBe(0);
    expect(motorLevel([5])).toBe(70);
    expect(motorLevel([1, 42, 42, 42])).toBe(42);
    expect(motorLevel([1, 120, 120, 120])).toBe(100);
  });

  it("stores intensity without vibrating the phone", () => {
    const vibrate = jest
      .spyOn(Vibration, "vibrate")
      .mockImplementation(() => undefined);

    applyToyMotor([1, 63, 63, 63]);
    jest.advanceTimersByTime(1000);

    expect(getToyIntensity()).toBe(63);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("clears stored intensity", () => {
    applyToyMotor([1, 63, 63, 63]);
    stopToy();

    expect(getToyIntensity()).toBe(0);
  });
});
