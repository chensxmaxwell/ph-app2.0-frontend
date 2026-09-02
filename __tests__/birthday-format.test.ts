import { describe, expect, it } from "@jest/globals";
import { formatBirthdayInput } from "../src/screens/avatar/birthday";

describe("formatBirthdayInput", () => {
  it("formats a digit-only birthday paste as mm/dd/yyyy", () => {
    expect(formatBirthdayInput("12112001")).toBe("12/11/2001");
  });

  it("inserts separators as the next date segment is typed", () => {
    expect(formatBirthdayInput("1")).toBe("1");
    expect(formatBirthdayInput("12")).toBe("12");
    expect(formatBirthdayInput("123")).toBe("12/3");
    expect(formatBirthdayInput("1234")).toBe("12/34");
    expect(formatBirthdayInput("12345")).toBe("12/34/5");
  });

  it("removes orphaned separators while backspacing", () => {
    expect(formatBirthdayInput("12/34/")).toBe("12/34");
    expect(formatBirthdayInput("12/")).toBe("12");
  });

  it("does not reinsert a separator deleted with backspace", () => {
    expect(formatBirthdayInput("123", "12/3")).toBe("13");
    expect(formatBirthdayInput("12/345", "12/34/5")).toBe("12/35");
  });

  it("limits the value to eight date digits", () => {
    expect(formatBirthdayInput("1211200199")).toBe("12/11/2001");
  });
});
