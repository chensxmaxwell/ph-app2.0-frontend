// WeChat-style chat timestamps in the app's English UI.
//
// Every label is derived at render time from a real epoch (`sentAt`,
// `lastActivityAt`) and the device's local timezone — only local `Date`
// getters are used, never UTC ones, so Maxwell's phone in Asia/Shanghai shows
// Shanghai wall-clock times.
//
//   Message list row (compressed like the WeChat inbox)
//     under 1 minute      now
//     under 60 minutes    3 min ago
//     same calendar day   2:14 PM
//     yesterday           Yesterday
//     2–6 days ago        Mon
//     same year           Sep 2
//     another year        Sep 2, 2025
//
//   Thread separator (WeChat shows a time line above a bubble instead of a
//   time on every bubble): same buckets, the calendar ones followed by the
//   wall clock — "Yesterday 2:14 PM", "Mon 2:14 PM", "Sep 2, 2:14 PM",
//   "Sep 2, 2025, 2:14 PM".
//
// The two relative buckets win over the calendar ones on purpose: a message
// from 40 minutes ago reads "40 min ago" even if midnight passed in between.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

// A weekday name is only unambiguous while it cannot repeat, so the weekday
// bucket stops before a full week and older messages fall through to a date.
const WEEKDAY_BUCKET_MAX_DAYS = 6;

// WeChat draws a new time line above a bubble once this long has passed since
// the bubble before it.
export const SEPARATOR_GAP_MS = 5 * MINUTE_MS;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type ChatTimeBucket =
  | { kind: "now" }
  | { kind: "minutes"; minutes: number }
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "weekday" }
  | { kind: "date" }
  | { kind: "dateWithYear" };

const startOfLocalDay = (ms: number) => {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

// Whole local calendar days from `sentAt` to `now` (0 = same day). Comparing
// local midnights and rounding keeps a DST 23/25-hour day from being
// miscounted.
export const calendarDaysBetween = (sentAt: number, now: number) =>
  Math.round((startOfLocalDay(now) - startOfLocalDay(sentAt)) / DAY_MS);

export const chatTimeBucket = (sentAt: number, now: number): ChatTimeBucket => {
  const elapsed = now - sentAt;
  // A negative gap means the device clock moved; treat it as just sent rather
  // than showing a time in the future.
  if (elapsed < MINUTE_MS) {
    return { kind: "now" };
  }
  if (elapsed < HOUR_MS) {
    return { kind: "minutes", minutes: Math.floor(elapsed / MINUTE_MS) };
  }
  const days = calendarDaysBetween(sentAt, now);
  if (days <= 0) {
    return { kind: "today" };
  }
  if (days === 1) {
    return { kind: "yesterday" };
  }
  if (days <= WEEKDAY_BUCKET_MAX_DAYS) {
    return { kind: "weekday" };
  }
  if (new Date(sentAt).getFullYear() === new Date(now).getFullYear()) {
    return { kind: "date" };
  }
  return { kind: "dateWithYear" };
};

// 12-hour wall clock without a leading zero on the hour: "2:14 PM", "12:05 AM".
export const formatClock = (ms: number) => {
  const date = new Date(ms);
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hour12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
};

const formatWeekday = (ms: number) => WEEKDAYS[new Date(ms).getDay()];

const formatDate = (ms: number, withYear: boolean) => {
  const date = new Date(ms);
  const monthDay = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return withYear ? `${monthDay}, ${date.getFullYear()}` : monthDay;
};

export const formatChatListTime = (
  sentAt: number,
  now: number = Date.now()
): string => {
  const bucket = chatTimeBucket(sentAt, now);
  switch (bucket.kind) {
    case "now":
      return "now";
    case "minutes":
      return `${bucket.minutes} min ago`;
    case "today":
      return formatClock(sentAt);
    case "yesterday":
      return "Yesterday";
    case "weekday":
      return formatWeekday(sentAt);
    case "date":
      return formatDate(sentAt, false);
    case "dateWithYear":
      return formatDate(sentAt, true);
    default: {
      const exhaustive: never = bucket;
      return exhaustive;
    }
  }
};

export const formatChatThreadTime = (
  sentAt: number,
  now: number = Date.now()
): string => {
  const bucket = chatTimeBucket(sentAt, now);
  switch (bucket.kind) {
    case "now":
    case "minutes":
    case "today":
      return formatChatListTime(sentAt, now);
    case "yesterday":
      return `Yesterday ${formatClock(sentAt)}`;
    case "weekday":
      return `${formatWeekday(sentAt)} ${formatClock(sentAt)}`;
    case "date":
      return `${formatDate(sentAt, false)}, ${formatClock(sentAt)}`;
    case "dateWithYear":
      return `${formatDate(sentAt, true)}, ${formatClock(sentAt)}`;
    default: {
      const exhaustive: never = bucket;
      return exhaustive;
    }
  }
};

// The first bubble in a thread always gets a time line; later bubbles only
// when they follow a gap of SEPARATOR_GAP_MS or more, like WeChat.
export const showsTimeSeparator = (
  previous: { sentAt: number } | undefined,
  current: { sentAt: number }
) => !previous || current.sentAt - previous.sentAt >= SEPARATOR_GAP_MS;
