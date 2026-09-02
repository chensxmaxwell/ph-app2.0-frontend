import { describe, expect, it } from "@jest/globals";
import { dbToSensitivityPct } from "../src/screens/sound/db-sensitivity";

describe("dbToSensitivityPct", () => {
  it("maps -45 dB to 0%", () => {
    expect(dbToSensitivityPct(-45)).toBe(0);
  });

  it("maps 0 dB to 100%", () => {
    expect(dbToSensitivityPct(0)).toBe(100);
  });

  it("maps -34 dB to about 24%", () => {
    expect(dbToSensitivityPct(-34)).toBe(24);
  });

  it("clamps silence below -45 dB to 0%", () => {
    expect(dbToSensitivityPct(-60)).toBe(0);
    expect(dbToSensitivityPct(-100)).toBe(0);
  });

  it("clamps loudness above 0 dB to 100%", () => {
    expect(dbToSensitivityPct(5)).toBe(100);
    expect(dbToSensitivityPct(20)).toBe(100);
  });

  it("maps the midpoint -22.5 dB to 50%", () => {
    expect(dbToSensitivityPct(-22.5)).toBe(50);
  });
});
