import React, { ReactNode } from "react";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { writeSessionUser } from "../src/backend/session";
import { seedThreads } from "../src/backend/chat-seed";
import {
  FEMALE_VOICES,
  MALE_VOICES,
  SEED_VOICES,
  VOICES,
  assignVoiceForGender,
  voiceById,
  voiceForPerson,
  voiceMatchesGender,
  voicePoolForGender,
} from "../src/services/voices";
import { configureTtsEngine, TtsSpeakInput } from "../src/services/tts";
import {
  Companion,
  CompanionsProvider,
  useCompanions,
} from "../src/store/companions";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import { LoveSessionProvider } from "../src/screens/love/session";
import { clearLoveSessionBoot } from "../src/screens/love/session-persist";
import {
  AvatarWizardProvider,
  DEFAULT_DRAFT,
  GenderOption,
  useAvatarWizard,
} from "../src/screens/avatar/context";
import { useSaveCompanion } from "../src/screens/avatar/use-save-companion";
import type { WizardMode } from "../src/screens/avatar/types";

/**
 * Every companion speaks with a voice of their gender (Maxwell, TestFlight
 * 1.2 (14): Amanda must not sound like the robotic system default, Kevin
 * and Chad must be men). Creating a character draws a voice at random from
 * that gender's pool and persists it on the companion record and the Message
 * thread, so calls and Listen reuse the same voice for the same person.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn(), getParent: () => undefined }),
  useIsFocused: () => true,
}));

const genderOf = (voiceId?: string) => voiceById(voiceId)?.gender;

const Providers = ({ children }: { children: ReactNode }) => (
  <CompanionsProvider>
    <LoveSessionProvider>
      <ChatProvider>{children}</ChatProvider>
    </LoveSessionProvider>
  </CompanionsProvider>
);

const flush = async () => {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};
const settle = () => act(flush);

const trees: ReactTestRenderer[] = [];

type ChatApi = ReturnType<typeof useChat>;
type CompanionsApi = ReturnType<typeof useCompanions>;
type WizardApi = ReturnType<typeof useAvatarWizard>;
let chat: ChatApi | null = null;
let companionsApi: CompanionsApi | null = null;
let wizard: WizardApi | null = null;
let save: (() => Companion) | null = null;

const Probe = () => {
  chat = useChat();
  companionsApi = useCompanions();
  return null;
};

const WizardProbe = () => {
  wizard = useAvatarWizard();
  save = useSaveCompanion();
  return null;
};

const mount = async (children: ReactNode) => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Providers>{children}</Providers>);
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

const mountWizard = async ({
  mode,
  companionId,
  gender,
  name,
}: {
  mode: WizardMode;
  companionId: string;
  gender: GenderOption;
  name: string;
}) =>
  mount(
    <>
      <Probe />
      <AvatarWizardProvider
        mode={mode}
        companionId={companionId}
        initialDraft={{ ...DEFAULT_DRAFT, name, gender, avatar: "look" }}
      >
        <WizardProbe />
      </AvatarWizardProvider>
    </>
  );

beforeEach(async () => {
  await AsyncStorage.clear();
  clearLoveSessionBoot();
  await writeSessionUser({ id: "demo", email: "demo@local", token: "t" });
  chat = null;
  companionsApi = null;
  wizard = null;
  save = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
  configureTtsEngine({
    speak: async () => undefined,
    stop: async () => undefined,
  });
});

describe("voice pools", () => {
  it("female and male pools are Doubao Seed-TTS 2.0 speakers of that gender and do not overlap", () => {
    expect(FEMALE_VOICES.length).toBeGreaterThanOrEqual(4);
    expect(MALE_VOICES.length).toBeGreaterThanOrEqual(4);
    FEMALE_VOICES.forEach((voice) => {
      expect(voice.id).toMatch(/^zh_female_[a-z0-9]+_uranus_bigtts$/);
      expect(voice.gender).toBe("female");
    });
    MALE_VOICES.forEach((voice) => {
      expect(voice.id).toMatch(/^zh_male_[a-z0-9]+_uranus_bigtts$/);
      expect(voice.gender).toBe("male");
    });
    expect(new Set(VOICES.map((voice) => voice.id)).size).toBe(VOICES.length);
  });

  it("Female draws from the female pool, Male from the male pool, Non-binary from both", () => {
    expect(voicePoolForGender("Female")).toEqual(FEMALE_VOICES);
    expect(voicePoolForGender("Male")).toEqual(MALE_VOICES);
    expect(voicePoolForGender("Non-binary")).toEqual(VOICES);
    expect(voicePoolForGender(undefined)).toEqual(VOICES);
  });

  it("assignment is random within the pool", () => {
    expect(assignVoiceForGender("Female", () => 0)).toBe(FEMALE_VOICES[0].id);
    expect(assignVoiceForGender("Female", () => 0.999)).toBe(
      FEMALE_VOICES[FEMALE_VOICES.length - 1].id
    );
    expect(assignVoiceForGender("Male", () => 0)).toBe(MALE_VOICES[0].id);
    expect(genderOf(assignVoiceForGender("Male", () => 0.5))).toBe("male");
    expect(genderOf(assignVoiceForGender("Female", () => 0.5))).toBe("female");
    const nonBinary = new Set(
      [0, 0.3, 0.6, 0.999].map((value) =>
        genderOf(assignVoiceForGender("Non-binary", () => value))
      )
    );
    expect(nonBinary).toEqual(new Set(["female", "male"]));
  });

  it("knows whether a voice fits a gender; Non-binary accepts either", () => {
    expect(voiceMatchesGender(FEMALE_VOICES[0].id, "Female")).toBe(true);
    expect(voiceMatchesGender(FEMALE_VOICES[0].id, "Male")).toBe(false);
    expect(voiceMatchesGender(MALE_VOICES[0].id, "Non-binary")).toBe(true);
    expect(voiceMatchesGender(undefined, "Female")).toBe(false);
    expect(voiceMatchesGender("not-a-voice", "Female")).toBe(false);
  });
});

describe("seeded people", () => {
  it("Amanda is seeded with a female voice, Kevin and Chad with male voices", () => {
    const byId = new Map(seedThreads().map((thread) => [thread.id, thread]));
    expect(genderOf(byId.get("amanda")?.voiceId)).toBe("female");
    expect(genderOf(byId.get("kevin")?.voiceId)).toBe("male");
    expect(genderOf(byId.get("chad")?.voiceId)).toBe("male");
    expect(byId.get("amanda")?.voiceId).toBe(SEED_VOICES.amanda);
    expect(byId.get("kevin")?.voiceId).toBe(SEED_VOICES.kevin);
    expect(byId.get("chad")?.voiceId).toBe(SEED_VOICES.chad);
  });

  it("a thread persisted before voices existed still resolves to a voice of its gender, the same one every time", () => {
    const [kevin, , amanda] = seedThreads().map((thread) => {
      const legacy = { ...thread };
      delete legacy.voiceId;
      return legacy;
    });
    expect(voiceForPerson({ thread: amanda }).gender).toBe("female");
    expect(voiceForPerson({ thread: kevin }).gender).toBe("male");
    expect(voiceForPerson({ thread: amanda }).id).toBe(
      voiceForPerson({ thread: amanda }).id
    );
    // An unknown person with a gender still gets that gender's voice.
    expect(
      voiceForPerson({
        thread: { ...amanda, id: "someone", name: "Someone", gender: "Male" },
      }).gender
    ).toBe("male");
    // The stored pick wins over everything.
    expect(
      voiceForPerson({ thread: { ...amanda, voiceId: MALE_VOICES[1].id } }).id
    ).toBe(MALE_VOICES[1].id);
  });
});

describe("creating a character assigns a voice for the gender", () => {
  it("Female → a female voice, persisted on the companion record and the thread", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.42);
    await mountWizard({
      mode: "create",
      companionId: "companion-nova",
      gender: "Female",
      name: "Nova",
    });
    act(() => {
      save!();
    });
    await settle();

    const expected = assignVoiceForGender("Female", () => 0.42);
    const record = companionsApi!.companions.find(
      (item) => item.id === "companion-nova"
    )!;
    const thread = chat!.getThread("companion-nova")!;
    expect(record.voiceId).toBe(expected);
    expect(thread.voiceId).toBe(expected);
    expect(genderOf(record.voiceId)).toBe("female");
    expect(voiceForPerson({ thread, companion: record }).id).toBe(expected);
  });

  it("Male → a male voice", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.1);
    await mountWizard({
      mode: "create",
      companionId: "companion-rex",
      gender: "Male",
      name: "Rex",
    });
    act(() => {
      save!();
    });
    await settle();

    const record = companionsApi!.companions.find(
      (item) => item.id === "companion-rex"
    )!;
    expect(genderOf(record.voiceId)).toBe("male");
    expect(chat!.getThread("companion-rex")!.voiceId).toBe(record.voiceId);
    expect(record.voiceId).toBe(assignVoiceForGender("Male", () => 0.1));
  });

  it("a crafted Amanda folds onto the seeded thread and takes a female voice there too", async () => {
    await mountWizard({
      mode: "create",
      companionId: "companion-amanda",
      gender: "Female",
      name: "Amanda",
    });
    act(() => {
      save!();
    });
    await settle();

    const thread = chat!.getThread("amanda")!;
    expect(genderOf(thread.voiceId)).toBe("female");
    const record = companionsApi!.companions.find((item) => item.id === "amanda")!;
    expect(record.voiceId).toBe(thread.voiceId);
  });

  it("editing a persona keeps the voice while the gender fits and redraws it when the gender changes", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.42);
    await mountWizard({
      mode: "create",
      companionId: "companion-nova",
      gender: "Female",
      name: "Nova",
    });
    act(() => {
      save!();
    });
    await settle();
    const first = companionsApi!.companions.find(
      (item) => item.id === "companion-nova"
    )!.voiceId;
    expect(genderOf(first)).toBe("female");
    act(() => {
      trees.splice(0).forEach((tree) => tree.unmount());
    });

    // Same gender: the voice is part of who they are, so it stays.
    await mountWizard({
      mode: "editPersona",
      companionId: "companion-nova",
      gender: "Female",
      name: "Nova",
    });
    act(() => {
      wizard!.patchDraft({ story: "Rewritten." });
    });
    act(() => {
      save!();
    });
    await settle();
    expect(
      companionsApi!.companions.find((item) => item.id === "companion-nova")!
        .voiceId
    ).toBe(first);
    expect(chat!.getThread("companion-nova")!.voiceId).toBe(first);
    act(() => {
      trees.splice(0).forEach((tree) => tree.unmount());
    });

    // Gender changed: the old voice no longer fits.
    await mountWizard({
      mode: "editPersona",
      companionId: "companion-nova",
      gender: "Female",
      name: "Nova",
    });
    act(() => {
      wizard!.patchDraft({ gender: "Male" });
    });
    act(() => {
      save!();
    });
    await settle();
    const record = companionsApi!.companions.find(
      (item) => item.id === "companion-nova"
    )!;
    expect(genderOf(record.voiceId)).toBe("male");
    expect(chat!.getThread("companion-nova")!.voiceId).toBe(record.voiceId);
  });

  it("editing seeded Amanda's persona (no 3D record) writes her voice on the thread only", async () => {
    await mountWizard({
      mode: "editPersona",
      companionId: "amanda",
      gender: "Female",
      name: "Amanda",
    });
    act(() => {
      wizard!.patchDraft({ story: "Still Amanda." });
    });
    act(() => {
      save!();
    });
    await settle();
    expect(companionsApi!.companions).toEqual([]);
    expect(chat!.getThread("amanda")!.voiceId).toBe(SEED_VOICES.amanda);
  });
});

describe("Listen speaks with the person's voice", () => {
  it("Amanda's messages are read in her female voice, Kevin's in his male voice", async () => {
    const speak = jest.fn<(input: TtsSpeakInput) => Promise<void>>(
      async () => undefined
    );
    configureTtsEngine({ speak, stop: async () => undefined });
    await mount(<Probe />);

    act(() => {
      chat!.setListen("amanda", true);
    });
    await settle();
    expect(speak).toHaveBeenCalledTimes(1);
    const amandaCall = speak.mock.calls[0][0];
    expect(amandaCall.voiceId).toBe(SEED_VOICES.amanda);
    expect(genderOf(amandaCall.voiceId)).toBe("female");

    act(() => {
      chat!.setListen("amanda", false);
      chat!.setListen("kevin", true);
    });
    await settle();
    const kevinCall = speak.mock.calls[speak.mock.calls.length - 1][0];
    expect(genderOf(kevinCall.voiceId)).toBe("male");
  });
});
