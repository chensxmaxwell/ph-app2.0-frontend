import React from "react";
import renderer, {
  act,
  ReactTestInstance,
  ReactTestRenderer,
} from "react-test-renderer";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCREENS } from "../src/common/constant";
import { writeSessionUser } from "../src/backend/session";
import { loadChat } from "../src/backend/store";
import { seedThreads } from "../src/backend/chat-seed";
import {
  normalizeThreadTimestamps,
  sentAtFromId,
} from "../src/backend/chat-timestamps";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import { Chat } from "../src/screens/chat";
import { ChatThreadScreen } from "../src/screens/chat/thread";
import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  formatChatListTime,
  formatClock,
} from "../src/screens/chat/time";
import { NOW_TICK_MS } from "../src/screens/chat/use-now";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-linear-gradient", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View };
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => insets,
  };
});
jest.mock("../src/screens/love/pill", () => ({
  useOpenLove: () => jest.fn(),
}));

type FakeNavigation = {
  goBack: () => void;
  navigate: (name: string, params?: object) => void;
  getParent: () => FakeNavigation | undefined;
};

const fakeNavigation = (parent?: FakeNavigation): FakeNavigation => ({
  goBack: jest.fn(),
  navigate: jest.fn(),
  getParent: () => parent,
});

let mockNavigation: FakeNavigation = fakeNavigation(fakeNavigation());
let mockRoute: { name: string; params?: object } = {
  name: String(SCREENS.CHAT),
};
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useIsFocused: () => true,
}));

const local = (
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0
) => new Date(year, monthIndex, day, hours, minutes, 0).getTime();

// Wednesday, Sep 2 2026, 3:30 PM local. Fake timers pin Date.now() here so
// the seeds, the store's stamps and the tick are all deterministic.
const NOW = local(2026, 8, 2, 15, 30);
const CHAT_KEY = "ph.chat.v2:demo";

type ChatApi = ReturnType<typeof useChat>;
let api: ChatApi | null = null;
const Probe = () => {
  api = useChat();
  return null;
};

const flush = async () => {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};
const settle = () => act(flush);

const advance = async (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  await settle();
};

// The store debounces its AsyncStorage write by 250ms.
const persisted = () => advance(300);

const trees: ReactTestRenderer[] = [];

const Screens = ({ thread }: { thread?: string }) => (
  <ChatProvider>
    <Probe />
    <Chat />
    {thread ? <ChatThreadScreen /> : null}
  </ChatProvider>
);

const mountList = async () => {
  mockNavigation = fakeNavigation(fakeNavigation());
  mockRoute = { name: String(SCREENS.CHAT) };
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Screens />);
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

const openThreadScreen = async (tree: ReactTestRenderer, threadId: string) => {
  mockRoute = { name: String(SCREENS.CHAT_THREAD), params: { threadId } };
  act(() => {
    tree.update(<Screens thread={threadId} />);
  });
  await settle();
};

const relaunch = async () => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  return mountList();
};

const textOf = (root: ReactTestInstance, testID: string) => {
  const nodes = root.findAll((node) => node.props.testID === testID);
  if (nodes.length === 0) {
    throw new Error(`No node with testID ${testID}`);
  }
  return React.Children.toArray(nodes[0].props.children).join("");
};

const hasTestID = (root: ReactTestInstance, testID: string) =>
  root.findAll((node) => node.props.testID === testID).length > 0;

const rowTime = (tree: ReactTestRenderer, threadId: string) =>
  textOf(tree.root, `message-row-time-${threadId}`);

const CLOCK = /^\d{1,2}:\d{2} (AM|PM)$/;

const legacyThread = (
  id: string,
  name: string,
  time: string,
  messages: { id: string; from: "them" | "me"; text: string }[]
) => ({
  id,
  name,
  kind: "bot",
  preview: messages[messages.length - 1]?.text ?? "",
  time,
  pinned: false,
  listen: false,
  synced: false,
  request: "none",
  messages,
});

beforeEach(async () => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "performance",
      "hrtime",
    ],
  });
  await AsyncStorage.clear();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  api = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  jest.useRealTimers();
});

describe("seeded Kevin / Chad / Amanda", () => {
  it("carry plausible past epochs, in order, and none of them is now", () => {
    const seeds = seedThreads(NOW);
    expect(seeds.map((thread) => thread.id)).toEqual(["kevin", "chad", "amanda"]);
    for (const thread of seeds) {
      expect("time" in thread).toBe(false);
      expect(thread.messages.length).toBeGreaterThan(0);
      for (const bubble of thread.messages) {
        expect(Number.isFinite(bubble.sentAt)).toBe(true);
        expect(bubble.sentAt).toBeLessThan(NOW - MINUTE_MS);
      }
      const times = thread.messages.map((bubble) => bubble.sentAt);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(thread.lastActivityAt).toBe(times[times.length - 1]);
      expect(formatChatListTime(thread.lastActivityAt, NOW)).not.toBe("now");
    }
    const [kevin, chad, amanda] = seeds;
    expect(formatChatListTime(amanda.lastActivityAt, NOW)).toBe("1:30 PM");
    expect(formatChatListTime(chad.lastActivityAt, NOW)).toBe("Yesterday");
    expect(formatChatListTime(kevin.lastActivityAt, NOW)).toBe("Sun");
  });

  it("show those times on the Message list rows", async () => {
    const tree = await mountList();
    expect(rowTime(tree, "amanda")).toBe("1:30 PM");
    expect(rowTime(tree, "chad")).toBe("Yesterday");
    expect(rowTime(tree, "kevin")).toBe("Sun");
  });
});

describe("sending a message", () => {
  it("stores an epoch sentAt on the bubble and lastActivityAt on the thread", async () => {
    await mountList();
    act(() => {
      api!.sendText("kevin", "hello there");
    });
    await settle();

    const kevin = api!.getThread("kevin")!;
    const mine = kevin.messages[kevin.messages.length - 1];
    expect(mine).toMatchObject({ from: "me", text: "hello there" });
    expect(typeof mine.sentAt).toBe("number");
    expect(mine.sentAt).toBe(NOW);
    expect(kevin.lastActivityAt).toBe(NOW);
    expect("time" in kevin).toBe(false);

    act(() => {
      api!.sendVoice("amanda");
    });
    await settle();
    const voice = api!.getThread("amanda")!.messages.slice(-1)[0];
    expect(voice.voice).toBe(true);
    expect(voice.sentAt).toBe(NOW);
  });

  it("persists the epoch, never the display string, and the row keeps aging after relaunch", async () => {
    let tree = await mountList();
    act(() => {
      api!.sendText("chad", "see you later");
    });
    await persisted();

    const raw = await AsyncStorage.getItem(CHAT_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw!);
    const chad = stored.threads.find((thread: { id: string }) => thread.id === "chad");
    expect(chad.lastActivityAt).toBe(NOW);
    expect(chad.messages.slice(-1)[0].sentAt).toBe(NOW);
    expect(chad.time).toBeUndefined();
    expect(raw).not.toMatch(/"time"/);
    expect(raw).not.toMatch(/"Now"/);
    for (const thread of stored.threads) {
      for (const bubble of thread.messages) {
        expect(typeof bubble.sentAt).toBe("number");
      }
    }

    expect(rowTime(tree, "chad")).toBe("now");
    await advance(2 * HOUR_MS);
    tree = await relaunch();
    expect(rowTime(tree, "chad")).toBe(formatClock(NOW));
    expect(rowTime(tree, "chad")).toBe("3:30 PM");
  });

  it("makes the row read now, then N min ago on the tick, then the clock, without relaunch", async () => {
    const tree = await mountList();
    act(() => {
      api!.sendText("kevin", "ticking");
    });
    await settle();
    expect(rowTime(tree, "kevin")).toBe("now");

    await advance(3 * MINUTE_MS + NOW_TICK_MS);
    expect(rowTime(tree, "kevin")).toBe("3 min ago");

    await advance(7 * MINUTE_MS);
    expect(rowTime(tree, "kevin")).toBe("10 min ago");

    await advance(2 * HOUR_MS);
    expect(rowTime(tree, "kevin")).toMatch(CLOCK);
    expect(rowTime(tree, "kevin")).toBe("3:30 PM");

    await advance(DAY_MS);
    expect(rowTime(tree, "kevin")).toBe("Yesterday");
  });

  it("a friend request stamps its thread too", async () => {
    await mountList();
    act(() => {
      api!.sendFriendRequest({
        id: "zoe",
        name: "Zoe",
        email: "zoe@local",
        gender: "Female",
        birthday: "01/01/2000",
        plan: "Free user",
      });
    });
    const zoe = api!.getThread("zoe")!;
    expect(zoe.lastActivityAt).toBe(NOW);
    expect(zoe.messages[0].sentAt).toBe(NOW);

    await advance(10 * MINUTE_MS);
    act(() => {
      api!.setRequest("zoe", "accepted");
    });
    const accepted = api!.getThread("zoe")!;
    expect(accepted.lastActivityAt).toBe(NOW + 10 * MINUTE_MS);
    expect(accepted.messages[0].sentAt).toBe(NOW + 10 * MINUTE_MS);
  });

  it("editing a persona does not bump the chat's time to now", async () => {
    const tree = await mountList();
    act(() => {
      api!.updateBot("kevin", {
        name: "Kevin",
        gender: "Male",
        birthday: "05/25/1976",
        description: "Rewritten story.",
      });
    });
    await settle();
    expect(rowTime(tree, "kevin")).toBe("Sun");
    expect(api!.getThread("kevin")!.lastActivityAt).toBe(
      seedThreads(NOW)[0].lastActivityAt
    );
  });
});

describe("thread time separators", () => {
  it("label the first bubble and each bubble after a 5 minute gap, with real times", async () => {
    const tree = await mountList();
    await openThreadScreen(tree, "kevin");
    // Kevin: 11:38, 11:41, 11:42, 11:49, 11:52 PM three nights ago.
    expect(textOf(tree.root, "message-time-k1")).toBe("Sun 11:38 PM");
    expect(hasTestID(tree.root, "message-time-k2")).toBe(false);
    expect(hasTestID(tree.root, "message-time-k3")).toBe(false);
    expect(textOf(tree.root, "message-time-k4")).toBe("Sun 11:49 PM");
    expect(hasTestID(tree.root, "message-time-k5")).toBe(false);

    await openThreadScreen(tree, "chad");
    expect(textOf(tree.root, "message-time-c1")).toBe("Yesterday 2:02 PM");
    expect(textOf(tree.root, "message-time-c4")).toBe("Yesterday 2:11 PM");

    await openThreadScreen(tree, "amanda");
    // Two hours ago is a clock time, not "now".
    expect(textOf(tree.root, "message-time-a1")).toBe("1:21 PM");
    for (const id of ["a2", "a3", "a4", "a5"]) {
      expect(hasTestID(tree.root, `message-time-${id}`)).toBe(false);
    }
  });

  it("a new message opens with now and ages to N min ago on the tick", async () => {
    const tree = await mountList();
    await openThreadScreen(tree, "amanda");
    act(() => {
      api!.sendText("amanda", "fresh");
    });
    await settle();
    const fresh = api!.getThread("amanda")!.messages.slice(-1)[0];
    expect(textOf(tree.root, `message-time-${fresh.id}`)).toBe("now");

    await advance(3 * MINUTE_MS + NOW_TICK_MS);
    expect(textOf(tree.root, `message-time-${fresh.id}`)).toBe("3 min ago");
  });
});

describe("legacy blobs (time: \"Now\" strings, bubbles without sentAt)", () => {
  it("recovers real epochs from message ids and gives seeded bubbles their seed times", async () => {
    const twoHoursAgo = NOW - 2 * HOUR_MS;
    const yesterday = NOW - DAY_MS;
    await AsyncStorage.setItem(
      CHAT_KEY,
      JSON.stringify({
        isPremium: false,
        threads: [
          legacyThread("kevin", "Kevin", "Yesterday", [
            { id: "k1", from: "them", text: "How's it going gorgeous?" },
            { id: "k2", from: "me", text: "Just got home. You still up?" },
            { id: "k5", from: "them", text: "Then stay. I've got you." },
          ]),
          legacyThread("zoe", "Zoe", "Now", [
            // Chat store ids encode Date.now(): `${epoch}-${hex}`.
            { id: `${twoHoursAgo}-a1b2c3`, from: "them", text: "two hours ago" },
            { id: "no-clock-in-this-id", from: "me", text: "unknown" },
          ]),
          legacyThread("relay", "Relay", "Now", [
            // backend/store nextId("msg"): `msg-${base36 epoch}-${hex}`.
            {
              id: `msg-${yesterday.toString(36)}-0f0f0f`,
              from: "them",
              text: "yesterday via backend",
            },
          ]),
        ],
      })
    );

    const tree = await mountList();

    const kevin = api!.getThread("kevin")!;
    expect("time" in kevin).toBe(false);
    expect(kevin.messages.map((bubble) => bubble.id)).toEqual(["k1", "k2", "k5"]);
    const seedKevin = seedThreads(NOW)[0];
    for (const bubble of kevin.messages) {
      expect(bubble.sentAt).toBe(
        seedKevin.messages.find((seed) => seed.id === bubble.id)!.sentAt
      );
    }
    expect(kevin.lastActivityAt).toBe(seedKevin.lastActivityAt);
    expect(rowTime(tree, "kevin")).toBe("Sun");

    const zoe = api!.getThread("zoe")!;
    expect(zoe.messages[0].sentAt).toBe(twoHoursAgo);
    expect(zoe.messages[1].sentAt).toBe(twoHoursAgo);
    expect(zoe.lastActivityAt).toBe(twoHoursAgo);
    expect(rowTime(tree, "zoe")).toBe("1:30 PM");

    const relay = api!.getThread("relay")!;
    expect(relay.messages[0].sentAt).toBe(yesterday);
    expect(rowTime(tree, "relay")).toBe("Yesterday");

    // Chad and Amanda were missing from the blob and come in as fresh seeds.
    expect(rowTime(tree, "chad")).toBe("Yesterday");
    expect(rowTime(tree, "amanda")).toBe("1:30 PM");

    // The migrated blob is what is on disk now: no display strings left.
    await persisted();
    const raw = (await AsyncStorage.getItem(CHAT_KEY))!;
    expect(raw).not.toMatch(/"time"/);
    const stored = await loadChat("demo");
    for (const thread of stored.threads) {
      expect(typeof thread.lastActivityAt).toBe("number");
      for (const bubble of thread.messages) {
        expect(typeof bubble.sentAt).toBe("number");
      }
    }
  });
});

describe("normalizeThreadTimestamps", () => {
  const seedKevin = seedThreads(NOW)[0];
  const bubble = (id: string, text = id, sentAt?: number) => ({
    id,
    from: "them" as const,
    text,
    ...(sentAt === undefined ? {} : { sentAt }),
  });
  const thread = (messages: ReturnType<typeof bubble>[], extra: object = {}) => ({
    id: "kevin",
    name: "Kevin",
    kind: "bot" as const,
    preview: "",
    pinned: false,
    listen: false,
    synced: false,
    request: "none" as const,
    messages,
    ...extra,
  });

  it("reads the epoch back out of store and backend ids, rejecting implausible ones", () => {
    expect(sentAtFromId(`${NOW - HOUR_MS}-ab12cd`, NOW)).toBe(NOW - HOUR_MS);
    expect(sentAtFromId(`msg-${(NOW - DAY_MS).toString(36)}-abcdef`, NOW)).toBe(
      NOW - DAY_MS
    );
    expect(sentAtFromId("k1", NOW)).toBeUndefined();
    expect(sentAtFromId(`${NOW + 3 * DAY_MS}-future`, NOW)).toBeUndefined();
    expect(sentAtFromId("100000000000-1973", NOW)).toBeUndefined();
  });

  it("returns the same thread when it is already stamped", () => {
    const stamped = thread([bubble("x", "x", NOW - HOUR_MS)], {
      lastActivityAt: NOW - HOUR_MS,
    });
    expect(normalizeThreadTimestamps(stamped, { now: NOW })).toBe(stamped);
  });

  it("never lets a seed time reorder a thread around a real recovered time", () => {
    const tenDaysAgo = NOW - 10 * DAY_MS;
    const out = normalizeThreadTimestamps(
      thread([
        bubble("k1"),
        bubble("k2"),
        bubble(`${tenDaysAgo}-real`, "real"),
        bubble("k5"),
      ]),
      { now: NOW, seed: seedKevin }
    );
    const times = out.messages.map((item) => item.sentAt);
    // k1 / k2 would sit after the real message, so they take its time.
    expect(times[0]).toBe(tenDaysAgo);
    expect(times[1]).toBe(tenDaysAgo);
    expect(times[2]).toBe(tenDaysAgo);
    // k5 comes after it and its seed time fits, so it keeps it.
    expect(times[3]).toBe(seedKevin.messages[4].sentAt);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(out.lastActivityAt).toBe(times[3]);
    expect("time" in out).toBe(false);
  });

  it("falls back to the thread time, then the seed, then the migration moment", () => {
    const withThreadTime = normalizeThreadTimestamps(
      thread([bubble("mystery")], { lastActivityAt: NOW - DAY_MS, time: "Now" }),
      { now: NOW }
    );
    expect(withThreadTime.messages[0].sentAt).toBe(NOW - DAY_MS);
    expect("time" in withThreadTime).toBe(false);

    const empty = normalizeThreadTimestamps(thread([], { time: "Now" }), {
      now: NOW,
      seed: seedKevin,
    });
    expect(empty.lastActivityAt).toBe(seedKevin.lastActivityAt);

    const unknown = normalizeThreadTimestamps(thread([bubble("mystery")]), {
      now: NOW,
    });
    expect(unknown.messages[0].sentAt).toBe(NOW);
    expect(unknown.lastActivityAt).toBe(NOW);
  });
});
