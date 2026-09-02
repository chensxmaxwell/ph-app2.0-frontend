import { describe, expect, it } from "@jest/globals";
import { dbToSensitivityPct } from "../src/screens/sound/db-to-sensitivity";

describe("dbToSensitivityPct", () => {
  it("maps silence at -45 dB to 0%", () => {
    expect(dbToSensitivityPct(-45)).toBe(0);
  });

  it("maps 0 dB to 100%", () => {
    expect(dbToSensitivityPct(0)).toBe(100);
  });

  it("maps -34 dB to about 24%", () => {
    expect(dbToSensitivityPct(-34)).toBe(24);
  });

  it("clamps below -45 dB to 0%", () => {
    expect(dbToSensitivityPct(-60)).toBe(0);
    expect(dbToSensitivityPct(-160)).toBe(0);
  });

  it("clamps above 0 dB to 100%", () => {
    expect(dbToSensitivityPct(1)).toBe(100);
    expect(dbToSensitivityPct(12)).toBe(100);
  });

  it("is linear between the endpoints", () => {
    expect(dbToSensitivityPct(-22.5)).toBe(50);
    expect(dbToSensitivityPct(-9)).toBe(80);
  });
});
