import { describe, expect, it } from "@jest/globals";
import { resolveLovePerson, loveMessagesFromThread } from "../src/screens/love/partner";
import { shouldReuseLoveChat } from "../src/screens/love/session-logic";
import {
  ANONYMOUS_USER_NAME,
  isBypassUser,
  resolveProfileDisplayName,
} from "../src/screens/profile/display-name";
import { MOCK_HOME_COMPANIONS } from "../src/screens/home/mock-companions";
import type { Companion } from "../src/store/companions";
import type { ChatThread } from "../src/screens/chat/types";

const kevin = {
  id: "created-kevin",
  name: "Created Kevin",
  birthday: "01/01/2000",
  gender: "Male",
  personalities: ["Playful & whimsical"],
  story: "A custom companion.",
} as Companion;

const threads: ChatThread[] = [
  {
    id: "kevin",
    name: "Kevin",
    kind: "bot",
    preview: "Hey",
    lastActivityAt: 1_700_000_000_000,
    pinned: true,
    listen: false,
    synced: false,
    request: "none",
    personality: "Playful, attentive, a little mischievous.",
    description: "Kevin is playful.",
    messages: [
      {
        id: "k1",
        from: "them",
        text: "How’s it going gorgeous?",
        sentAt: 1_700_000_000_000,
      },
    ],
  },
  {
    id: "chad",
    name: "Chad",
    kind: "human",
    preview: "Chad wants to chat",
    lastActivityAt: 1_700_000_000_000,
    pinned: false,
    listen: false,
    synced: false,
    request: "incoming",
    personality: "Direct, confident, a little competitive.",
    description: "Chad is direct.",
    messages: [],
  },
  {
    id: "amanda",
    name: "Amanda",
    kind: "bot",
    preview: "Hey, it's Amanda.",
    lastActivityAt: 1_700_000_000_000,
    pinned: false,
    listen: false,
    synced: false,
    request: "none",
    personality: "Warm, witty, and a little teasing.",
    description: "Amanda likes late-night talks.",
    messages: [
      {
        id: "a1",
        from: "them",
        text: "Hey, it's Amanda. I saved you a seat.",
        sentAt: 1_700_000_000_000,
      },
    ],
  },
];

describe("resolveLovePerson", () => {
  it("keeps created companion identity when that id is tapped", () => {
    const person = resolveLovePerson({
      companionId: kevin.id,
      companions: [kevin],
      threads,
      activeCompanion: null,
    });
    expect(person.companionId).toBe(kevin.id);
    expect(person.name).toBe("Created Kevin");
    expect(person.personality).toContain("Playful");
    expect(person.story).toBe("A custom companion.");
  });

  it("does not fall back to the active companion when a mock id is tapped", () => {
    const person = resolveLovePerson({
      companionId: "chad",
      companions: [kevin],
      threads,
      activeCompanion: kevin,
    });
    expect(person.companionId).toBe("chad");
    expect(person.name).toBe("Chad");
    expect(person.companion).toBeUndefined();
    expect(person.personality).toContain("Direct");
  });

  it("binds Kevin, Chad, and Amanda to different threads", () => {
    const names = MOCK_HOME_COMPANIONS.map((item) => {
      const person = resolveLovePerson({
        companionId: item.id,
        name: item.name,
        companions: [],
        threads,
        activeCompanion: null,
      });
      return person.name;
    });
    expect(names).toEqual(["Kevin", "Chad", "Amanda"]);
    expect(new Set(names).size).toBe(3);
  });

  it("hydrates Love messages from the Kevin thread only", () => {
    const kevinMessages = loveMessagesFromThread(
      threads.find((thread) => thread.id === "kevin")
    );
    const amandaMessages = loveMessagesFromThread(
      threads.find((thread) => thread.id === "amanda")
    );
    expect(kevinMessages?.[0]).toMatchObject({
      text: "How’s it going gorgeous?",
    });
    expect(amandaMessages?.[0]).toMatchObject({
      text: "Hey, it's Amanda. I saved you a seat.",
    });
  });
});

describe("shouldReuseLoveChat", () => {
  it("does not reuse a session when the companion id is missing", () => {
    expect(
      shouldReuseLoveChat({
        currentCompanionId: undefined,
        nextCompanionId: "kevin",
      })
    ).toBe(false);
  });

  it("does not reuse a session when switching people", () => {
    expect(
      shouldReuseLoveChat({
        currentCompanionId: "kevin",
        nextCompanionId: "amanda",
      })
    ).toBe(false);
  });

  it("reuses a session only for the same companion id", () => {
    expect(
      shouldReuseLoveChat({
        currentCompanionId: "kevin",
        nextCompanionId: "kevin",
      })
    ).toBe(true);
  });
});

describe("profile display name", () => {
  it("shows Anonymous User for bypass login", () => {
    expect(
      resolveProfileDisplayName({
        user: { id: "bypass", email: "bypass@local", token: "bypass" },
        profileName: "Amanda Guo",
      })
    ).toBe(ANONYMOUS_USER_NAME);
    expect(isBypassUser({ id: "bypass" })).toBe(true);
  });

  it("shows the real profile name for a logged-in user", () => {
    expect(
      resolveProfileDisplayName({
        user: { id: "user-1", email: "max@example.com" },
        profileName: "Maxwell Chen",
      })
    ).toBe("Maxwell Chen");
  });

  it("does not default a missing profile to Amanda Guo", () => {
    expect(
      resolveProfileDisplayName({
        user: { id: "user-1", email: "max@example.com" },
        profileName: "",
      })
    ).toBe(ANONYMOUS_USER_NAME);
  });
});
