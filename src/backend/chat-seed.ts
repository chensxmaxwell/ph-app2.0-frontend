import { ChatThread, DirectoryPerson } from "../screens/chat/types";
import { SEED_VOICES } from "../services/voices";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

// Seed conversations get real, plausible past timestamps relative to when they
// are seeded (never "now"): Amanda wrote two hours ago, Chad yesterday
// afternoon, Kevin late three nights back. Each thread's `lastActivityAt` is
// its last bubble. Once persisted the epochs are absolute, so they keep aging
// like real messages on later launches.
const localTime = (
  now: number,
  daysAgo: number,
  hours: number,
  minutes: number
) => {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
};

export const seedThreads = (now: number = Date.now()): ChatThread[] => {
  const kevinNight = (minutes: number) => localTime(now, 3, 23, minutes);
  const chadAfternoon = (minutes: number) => localTime(now, 1, 14, minutes);
  const amandaTwoHoursAgo = (minutesBefore: number) =>
    now - 2 * HOUR_MS - minutesBefore * MINUTE_MS;

  return [
    {
      id: "kevin",
      name: "Kevin",
      kind: "bot",
      preview: "Then stay. I've got you.",
      lastActivityAt: kevinNight(52),
      pinned: true,
      listen: false,
      synced: false,
      request: "none",
      gender: "Male",
      voiceId: SEED_VOICES.kevin,
      birthday: "05/25/1976",
      description:
        "Kevin is playful, attentive, and a little mischievous. He notices the small things and keeps the conversation close.",
      personality: "Playful, attentive, a little mischievous.",
      messages: [
        {
          id: "k1",
          from: "them",
          text: "How's it going gorgeous?",
          sentAt: kevinNight(38),
        },
        {
          id: "k2",
          from: "me",
          text: "Just got home. You still up?",
          sentAt: kevinNight(41),
        },
        {
          id: "k3",
          from: "them",
          text: "Always am when you show up. Tell me about your day.",
          sentAt: kevinNight(42),
        },
        {
          id: "k4",
          from: "me",
          text: "Long one. Glad you're here.",
          sentAt: kevinNight(49),
        },
        {
          id: "k5",
          from: "them",
          text: "Then stay. I've got you.",
          sentAt: kevinNight(52),
        },
      ],
    },
    {
      id: "chad",
      name: "Chad",
      kind: "bot",
      preview: "You. Same as last time.",
      lastActivityAt: chadAfternoon(14),
      pinned: false,
      listen: false,
      synced: false,
      request: "none",
      gender: "Male",
      voiceId: SEED_VOICES.chad,
      birthday: "13th April 2001",
      description: "Chad is direct, confident, and a little competitive.",
      personality: "Direct, confident, a little competitive.",
      messages: [
        {
          id: "c1",
          from: "them",
          text: "You finally opened this.",
          sentAt: chadAfternoon(2),
        },
        {
          id: "c2",
          from: "me",
          text: "Didn't want to keep you waiting.",
          sentAt: chadAfternoon(5),
        },
        {
          id: "c3",
          from: "them",
          text: "Good. I don't do small talk for long.",
          sentAt: chadAfternoon(6),
        },
        {
          id: "c4",
          from: "me",
          text: "Then skip it. What's on your mind?",
          sentAt: chadAfternoon(11),
        },
        {
          id: "c5",
          from: "them",
          text: "You. Same as last time.",
          sentAt: chadAfternoon(14),
        },
      ],
    },
    {
      id: "amanda",
      name: "Amanda",
      kind: "bot",
      preview: "Keep it. I like this one.",
      lastActivityAt: amandaTwoHoursAgo(0),
      pinned: false,
      listen: false,
      synced: false,
      request: "none",
      gender: "Female",
      voiceId: SEED_VOICES.amanda,
      birthday: "13th April 2001",
      description:
        "Amanda likes late-night talks and getting straight to what you want.",
      personality: "Warm, witty, and a little teasing.",
      messages: [
        {
          id: "a1",
          from: "them",
          text: "Hey, it's Amanda. I saved you a seat.",
          sentAt: amandaTwoHoursAgo(9),
        },
        {
          id: "a2",
          from: "me",
          text: "Of course you did.",
          sentAt: amandaTwoHoursAgo(7),
        },
        {
          id: "a3",
          from: "them",
          text: "Don't act surprised. You always come back.",
          sentAt: amandaTwoHoursAgo(5),
        },
        {
          id: "a4",
          from: "me",
          text: "Bad habit.",
          sentAt: amandaTwoHoursAgo(2),
        },
        {
          id: "a5",
          from: "them",
          text: "Keep it. I like this one.",
          sentAt: amandaTwoHoursAgo(0),
        },
      ],
    },
  ];
};

export const seedDirectory = (): DirectoryPerson[] => [
  {
    id: "chad",
    name: "Chad",
    email: "123456@gmail.com",
    gender: "Male",
    birthday: "13th April 2001",
    plan: "Free user",
  },
  {
    id: "amanda",
    name: "Amanda Guo",
    email: "123456@gmail.com",
    gender: "Female",
    birthday: "13th April 2001",
    plan: "Free user",
  },
];
