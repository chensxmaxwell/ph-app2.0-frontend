import { describe, expect, it } from "@jest/globals";
import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  SEPARATOR_GAP_MS,
  calendarDaysBetween,
  chatTimeBucket,
  formatChatListTime,
  formatChatThreadTime,
  formatClock,
  showsTimeSeparator,
} from "../src/screens/chat/time";

// Every instant is built with the local-time Date constructor so the
// expectations hold in whatever timezone Jest runs in (Maxwell's phone is
// Asia/Shanghai; CI is usually UTC).
const local = (
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0
) => new Date(year, monthIndex, day, hours, minutes, seconds).getTime();

// Wednesday, Sep 2 2026, 3:30:00 PM local.
const NOW = local(2026, 8, 2, 15, 30, 0);

describe("chat time buckets (WeChat style, English UI)", () => {
  it("shows now for anything under a minute old, including a clock that moved backwards", () => {
    expect(formatChatListTime(NOW, NOW)).toBe("now");
    expect(formatChatListTime(NOW - 30_000, NOW)).toBe("now");
    expect(formatChatListTime(NOW - 59_999, NOW)).toBe("now");
    expect(formatChatListTime(NOW + 5 * MINUTE_MS, NOW)).toBe("now");
    expect(formatChatThreadTime(NOW - 10_000, NOW)).toBe("now");
  });

  it("shows N min ago from one minute up to an hour", () => {
    expect(formatChatListTime(NOW - MINUTE_MS, NOW)).toBe("1 min ago");
    expect(formatChatListTime(NOW - 3 * MINUTE_MS, NOW)).toBe("3 min ago");
    expect(formatChatListTime(NOW - 3 * MINUTE_MS - 45_000, NOW)).toBe(
      "3 min ago"
    );
    expect(formatChatListTime(NOW - HOUR_MS + 1, NOW)).toBe("59 min ago");
    expect(formatChatThreadTime(NOW - 12 * MINUTE_MS, NOW)).toBe(
      "12 min ago"
    );
  });

  it("shows a 12-hour wall clock for the rest of today", () => {
    expect(formatChatListTime(NOW - HOUR_MS, NOW)).toBe("2:30 PM");
    // The bug report: a two-hour-old message must never read "now".
    expect(formatChatListTime(NOW - 2 * HOUR_MS, NOW)).toBe("1:30 PM");
    expect(formatChatThreadTime(NOW - 2 * HOUR_MS, NOW)).toBe("1:30 PM");
    expect(formatChatListTime(local(2026, 8, 2, 9, 5), NOW)).toBe("9:05 AM");
    expect(formatChatListTime(local(2026, 8, 2, 0, 5), NOW)).toBe("12:05 AM");
    expect(formatChatListTime(local(2026, 8, 2, 12, 0), NOW)).toBe("12:00 PM");
  });

  it("shows Yesterday on the list and Yesterday + clock inside the thread", () => {
    const yesterdayAfternoon = local(2026, 8, 1, 14, 14);
    expect(formatChatListTime(yesterdayAfternoon, NOW)).toBe("Yesterday");
    expect(formatChatThreadTime(yesterdayAfternoon, NOW)).toBe(
      "Yesterday 2:14 PM"
    );
    expect(formatChatListTime(local(2026, 8, 1, 23, 59), NOW)).toBe(
      "Yesterday"
    );
    expect(formatChatListTime(local(2026, 8, 1, 0, 0), NOW)).toBe("Yesterday");
  });

  it("uses the calendar day, not 24-hour windows, once past the relative buckets", () => {
    const justAfterMidnight = local(2026, 8, 2, 0, 30);
    // 40 minutes ago but yesterday by the calendar: the relative label wins.
    expect(
      formatChatListTime(justAfterMidnight - 40 * MINUTE_MS, justAfterMidnight)
    ).toBe("40 min ago");
    // Two hours ago crossing midnight is Yesterday, never "now".
    expect(
      formatChatListTime(justAfterMidnight - 2 * HOUR_MS, justAfterMidnight)
    ).toBe("Yesterday");
    expect(calendarDaysBetween(local(2026, 8, 1, 23, 59), local(2026, 8, 2, 0, 1))).toBe(1);
    expect(calendarDaysBetween(local(2026, 8, 2, 0, 1), local(2026, 8, 2, 23, 59))).toBe(0);
  });

  it("shows the weekday for two to six days ago, with the clock inside the thread", () => {
    expect(formatChatListTime(local(2026, 7, 31, 14, 14), NOW)).toBe("Mon");
    expect(formatChatListTime(local(2026, 7, 30, 23, 52), NOW)).toBe("Sun");
    expect(formatChatListTime(local(2026, 7, 27, 8, 0), NOW)).toBe("Thu");
    expect(formatChatThreadTime(local(2026, 7, 31, 14, 14), NOW)).toBe(
      "Mon 2:14 PM"
    );
    expect(formatChatThreadTime(local(2026, 7, 30, 23, 52), NOW)).toBe(
      "Sun 11:52 PM"
    );
  });

  it("falls back to a date a week out so a weekday name is never ambiguous", () => {
    // Seven days ago is also a Wednesday; it must not read "Wed".
    expect(formatChatListTime(local(2026, 7, 26, 14, 14), NOW)).toBe("Aug 26");
    expect(formatChatThreadTime(local(2026, 7, 26, 14, 14), NOW)).toBe(
      "Aug 26, 2:14 PM"
    );
    expect(formatChatListTime(local(2026, 0, 1, 9, 0), NOW)).toBe("Jan 1");
  });

  it("adds the year for another year", () => {
    expect(formatChatListTime(local(2025, 8, 2, 14, 14), NOW)).toBe(
      "Sep 2, 2025"
    );
    expect(formatChatThreadTime(local(2025, 8, 2, 14, 14), NOW)).toBe(
      "Sep 2, 2025, 2:14 PM"
    );
    expect(formatChatListTime(local(2025, 11, 31, 23, 59), NOW)).toBe(
      "Dec 31, 2025"
    );
  });

  it("only ever says now inside the first minute", () => {
    const offsets = [
      MINUTE_MS,
      5 * MINUTE_MS,
      59 * MINUTE_MS,
      HOUR_MS,
      2 * HOUR_MS,
      12 * HOUR_MS,
      DAY_MS,
      3 * DAY_MS,
      6 * DAY_MS,
      7 * DAY_MS,
      40 * DAY_MS,
      400 * DAY_MS,
    ];
    for (const offset of offsets) {
      expect(formatChatListTime(NOW - offset, NOW)).not.toBe("now");
      expect(formatChatThreadTime(NOW - offset, NOW)).not.toBe("now");
    }
    expect(offsets.map((offset) => chatTimeBucket(NOW - offset, NOW).kind)).toEqual([
      "minutes",
      "minutes",
      "minutes",
      "today",
      "today",
      "today",
      "yesterday",
      "weekday",
      "weekday",
      "date",
      "date",
      "dateWithYear",
    ]);
  });

  it("formats the clock without a leading zero on the hour", () => {
    expect(formatClock(local(2026, 8, 2, 14, 14))).toBe("2:14 PM");
    expect(formatClock(local(2026, 8, 2, 7, 3))).toBe("7:03 AM");
    expect(formatClock(local(2026, 8, 2, 0, 0))).toBe("12:00 AM");
    expect(formatClock(local(2026, 8, 2, 23, 59))).toBe("11:59 PM");
  });
});

describe("thread time separators", () => {
  it("always labels the first bubble", () => {
    expect(showsTimeSeparator(undefined, { sentAt: NOW })).toBe(true);
  });

  it("labels a bubble only after a five-minute gap, like WeChat", () => {
    const first = { sentAt: NOW - 20 * MINUTE_MS };
    expect(
      showsTimeSeparator(first, { sentAt: first.sentAt + SEPARATOR_GAP_MS - 1 })
    ).toBe(false);
    expect(
      showsTimeSeparator(first, { sentAt: first.sentAt + SEPARATOR_GAP_MS })
    ).toBe(true);
    expect(showsTimeSeparator(first, { sentAt: first.sentAt + 2 * HOUR_MS })).toBe(
      true
    );
  });
});
