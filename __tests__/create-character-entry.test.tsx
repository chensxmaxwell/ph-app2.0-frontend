import React, { ReactNode } from "react";
import { Text, TextInput, TouchableOpacity } from "react-native";
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
import { readFileSync } from "fs";
import { join } from "path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SCREENS } from "../src/common/constant";
import { writeSessionUser } from "../src/backend/session";
import { saveCompanions } from "../src/backend/store";
import {
  Companion,
  CompanionsProvider,
  useCompanions,
} from "../src/store/companions";
import { ChatProvider, useChat } from "../src/screens/chat/store";
import { LoveSessionProvider } from "../src/screens/love/session";
import { clearLoveSessionBoot } from "../src/screens/love/session-persist";
import { bindHomeStackNavigation } from "../src/screens/love/overlay";
import { Home } from "../src/screens/home";
import { Chat } from "../src/screens/chat";
import { ChatSettingsScreen } from "../src/screens/chat/settings";
import { AvatarStack } from "../src/screens/avatar/stack";
import { AvatarIdentityScreen } from "../src/screens/avatar/identity";
import {
  AvatarDraft,
  AvatarWizardProvider,
  DEFAULT_DRAFT,
  useAvatarWizard,
} from "../src/screens/avatar/context";
import { useSaveCompanion } from "../src/screens/avatar/use-save-companion";
import { isPlausibleBirthday } from "../src/screens/avatar/birthday";
import { companionFace } from "../src/screens/avatar/face";
import { PORTRAIT_IDS } from "../src/screens/avatar/portraits";
import { DEFAULT_LOOK, pickLook } from "../src/screens/avatar/engine/viewer-html";
import type { AvatarStackParams } from "../src/screens/avatar/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-linear-gradient", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View };
});
jest.mock("@react-native-community/blur", () => {
  const { View } = require("react-native");
  return { BlurView: View };
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
jest.mock("react-native-webview", () => ({ WebView: "MockWebView" }));
// Ships untranspiled ESM; only imported by wizard steps that never render here.
jest.mock("@miblanchard/react-native-slider", () => {
  const { View } = require("react-native");
  return { Slider: View };
});
jest.mock("../src/native/ph-native", () => ({
  bundledAvatarViewerUrl: () => "file:///avatar-engine/viewer-page.html",
}));
// Enough of a native stack to read which screen AvatarStack opens first and
// which component is registered under that name.
jest.mock("@react-navigation/native-stack", () => {
  const ReactModule = require("react");
  const Navigator = ({ children }: { children: unknown }) =>
    ReactModule.createElement(ReactModule.Fragment, null, children);
  const Screen = () => null;
  return { createNativeStackNavigator: () => ({ Navigator, Screen }) };
});
const { Navigator: StackNavigator, Screen: StackScreen } =
  createNativeStackNavigator();

type NavigateCall = { name: string; params?: object };
type FakeNavigation = {
  dispatch: () => void;
  goBack: () => void;
  navigate: (name: string, params?: object) => void;
  canGoBack: () => boolean;
  getParent: () => FakeNavigation | undefined;
  setOptions: () => void;
  addListener: () => () => void;
  calls: NavigateCall[];
};

const fakeNavigation = (parent?: FakeNavigation): FakeNavigation => {
  const calls: NavigateCall[] = [];
  return {
    dispatch: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn((name: string, params?: object) => {
      calls.push({ name, params });
    }),
    canGoBack: () => false,
    getParent: () => parent,
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => undefined),
    calls,
  };
};

let mockNavigation: FakeNavigation = fakeNavigation();
let mockRoute: { name: string; params?: object } = {
  name: String(SCREENS.NAV_BAR),
};
jest.mock("@react-navigation/native", () => {
  const routers = jest.requireActual("@react-navigation/routers") as {
    CommonActions: unknown;
  };
  return {
    CommonActions: routers.CommonActions,
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useIsFocused: () => true,
  };
});

const AVATAR_STACK = String(SCREENS.AVATAR_STACK);
const AVATAR_IDENTITY = String(SCREENS.AVATAR_IDENTITY);

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

const mount = async (children: ReactNode) => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Providers>{children}</Providers>);
  });
  trees.push(tree!);
  await settle();
  return tree!;
};

const press = (node: ReactTestInstance) => {
  act(() => {
    node.props.onPress();
  });
};

const touchable = (tree: ReactTestRenderer, testID: string) => {
  const match = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.testID === testID);
  if (!match) {
    throw new Error(`No TouchableOpacity with testID ${testID}`);
  }
  return match;
};

const input = (tree: ReactTestRenderer, testID: string) => {
  const match = tree.root
    .findAllByType(TextInput)
    .find((node) => node.props.testID === testID);
  if (!match) {
    throw new Error(`No TextInput with testID ${testID}`);
  }
  return match;
};

const type = (node: ReactTestInstance, value: string) => {
  act(() => {
    node.props.onChangeText(value);
  });
};

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => React.Children.toArray(node.props.children).join(""));

const buttonLabelled = (tree: ReactTestRenderer, label: string) => {
  const match = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) =>
      node
        .findAllByType(Text)
        .some(
          (text) =>
            React.Children.toArray(text.props.children).join("") === label
        )
    );
  if (!match) {
    throw new Error(`No button labelled ${label}`);
  }
  return match;
};

// The Home stack is what both tabs navigate on (their `getParent()`) and what
// openAvatarWizard resolves through bindHomeStackNavigation; it records the
// navigate call an entry makes.
const boundHomeStack = () => {
  const homeStack = fakeNavigation();
  bindHomeStackNavigation(homeStack as never);
  return homeStack;
};

const homePlusEntry = async () => {
  const homeStack = boundHomeStack();
  mockNavigation = fakeNavigation(homeStack);
  mockRoute = { name: String(SCREENS.HOME) };
  const tree = await mount(<Home />);
  press(touchable(tree, "home-add-companion"));
  expect(homeStack.calls).toHaveLength(1);
  return homeStack.calls[0];
};

const messagePlusCreateNewEntry = async () => {
  const homeStack = boundHomeStack();
  mockNavigation = fakeNavigation(homeStack);
  mockRoute = { name: String(SCREENS.CHAT) };
  const tree = await mount(<Chat />);
  press(touchable(tree, "message-add"));
  press(touchable(tree, "message-create-new"));
  expect(homeStack.calls).toHaveLength(1);
  return homeStack.calls[0];
};

const chatSettingsEditEntry = async (threadId: string) => {
  const homeStack = boundHomeStack();
  mockNavigation = homeStack;
  mockRoute = { name: String(SCREENS.CHAT_SETTINGS), params: { threadId } };
  const tree = await mount(<ChatSettingsScreen />);
  press(touchable(tree, "chat-settings-edit-persona"));
  expect(homeStack.calls).toHaveLength(1);
  return homeStack.calls[0];
};

// Follow an entry's navigate call into AvatarStack and read the screen it
// opens first: the route name, the component behind it, and the draft the
// wizard was seeded with.
const openedForm = async (entry: NavigateCall) => {
  if (entry.name !== AVATAR_STACK) {
    throw new Error(`${entry.name} is not the avatar wizard`);
  }
  mockNavigation = fakeNavigation(fakeNavigation());
  mockRoute = { name: entry.name, params: entry.params };
  const tree = await mount(<AvatarStack />);
  const initialRoute = tree.root.findByType(StackNavigator).props
    .initialRouteName as string;
  const screen = tree.root
    .findAllByType(StackScreen)
    .find((node) => node.props.name === initialRoute);
  if (!screen) {
    throw new Error(`${initialRoute} is not registered in AvatarStack`);
  }
  const provider = tree.root.findByType(AvatarWizardProvider);
  return {
    initialRoute,
    component: screen.props.component as React.ComponentType,
    mode: provider.props.mode as AvatarStackParams["mode"],
    companionId: provider.props.companionId as string,
    initialDraft: provider.props.initialDraft as AvatarDraft,
  };
};

// Render the form an entry opens, inside the wizard state it would get.
const renderForm = async (form: Awaited<ReturnType<typeof openedForm>>) => {
  mockNavigation = fakeNavigation(fakeNavigation());
  mockRoute = { name: form.initialRoute };
  const Form = form.component;
  return mount(
    <AvatarWizardProvider
      mode={form.mode ?? "create"}
      companionId={form.companionId}
      initialDraft={form.initialDraft}
    >
      <Form />
    </AvatarWizardProvider>
  );
};

const continueButton = (tree: ReactTestRenderer) =>
  buttonLabelled(tree, "Continue");

// The Choose avatar grid's tiles, in display order.
const avatarOptionIds = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .map((node) => String(node.props.testID ?? ""))
    .filter((id) => id.startsWith("avatar-option-"));

beforeEach(async () => {
  await AsyncStorage.clear();
  clearLoveSessionBoot();
  await writeSessionUser({
    id: "demo",
    email: "demo@local",
    token: "local.demo",
  });
  mockNavigation = fakeNavigation();
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
});

describe("Home + and Message + → Create new open the same create-character flow", () => {
  it("both navigate to the avatar wizard in create mode with identical params", async () => {
    const home = await homePlusEntry();
    const message = await messagePlusCreateNewEntry();

    expect(home).toEqual({ name: AVATAR_STACK, params: { mode: "create" } });
    expect(message).toEqual(home);
  });

  it("both mount the same first screen: the Identity basic-info page", async () => {
    const home = await openedForm(await homePlusEntry());
    const message = await openedForm(await messagePlusCreateNewEntry());

    expect(home.initialRoute).toBe(AVATAR_IDENTITY);
    expect(message.initialRoute).toBe(home.initialRoute);
    expect(home.component).toBe(AvatarIdentityScreen);
    expect(message.component).toBe(home.component);
    expect(message.initialDraft).toEqual(home.initialDraft);
  });

  it("the old Message-only ChatCreate form is gone, not just unlinked", () => {
    expect(Object.keys(SCREENS)).not.toContain("CHAT_CREATE");
    expect(Object.values(SCREENS).map(String)).not.toContain("ChatCreate");
  });
});

describe("the basic info page each entry lands on", () => {
  const entries = [
    ["Home +", homePlusEntry],
    ["Message + → Create new", messagePlusCreateNewEntry],
  ] as const;

  it.each(entries)(
    "%s: exactly name, gender, birthday and description — no extra fields",
    async (_label, entry) => {
      const tree = await renderForm(await openedForm(await entry()));

      const labels = texts(tree);
      expect(labels).toEqual(
        expect.arrayContaining(["Name", "Gender", "Birthday", "Description"])
      );
      expect(
        tree.root
          .findAllByType(TextInput)
          .map((node) => node.props.testID)
          .sort()
      ).toEqual(["identity-birthday", "identity-description", "identity-name"]);
      // Gender is a dropdown, not a free-text box, and every option can be
      // chosen: TestFlight 1.2 (13) still greyed Female / Non-binary out.
      press(touchable(tree, "identity-gender"));
      for (const option of ["Male", "Female", "Non-binary"]) {
        expect(
          touchable(tree, `identity-gender-${option}`).props.disabled
        ).toBe(false);
      }
      expect(texts(tree)).not.toContain("Female · unavailable");
      expect(texts(tree)).not.toContain("Demo: male avatar only for now");
      expect(texts(tree)).toContain(
        "3D appearance is the current body for every gender."
      );
      press(touchable(tree, "identity-gender-Female"));
      expect(texts(tree)).toContain("Female");
    }
  );

  it.each(entries)(
    "%s: a Choose avatar grid offers the 3D look and the portraits for the chosen gender",
    async (_label, entry) => {
      const tree = await renderForm(await openedForm(await entry()));
      expect(texts(tree)).toContain("Choose avatar");

      // Default gender is Male: the look you are about to craft + the three
      // male portraits. "Nova" owns no seeded photo.
      type(input(tree, "identity-name"), "Nova");
      expect(avatarOptionIds(tree)).toEqual([
        "avatar-option-look",
        "avatar-option-m-warm",
        "avatar-option-m-calm",
        "avatar-option-m-tousled",
      ]);

      press(touchable(tree, "identity-gender"));
      press(touchable(tree, "identity-gender-Female"));
      expect(avatarOptionIds(tree)).toEqual([
        "avatar-option-look",
        "avatar-option-f-bangs",
        "avatar-option-f-long",
      ]);

      press(touchable(tree, "identity-gender"));
      press(touchable(tree, "identity-gender-Non-binary"));
      expect(avatarOptionIds(tree)).toEqual([
        "avatar-option-look",
        ...PORTRAIT_IDS.map((id) => `avatar-option-${id}`),
      ]);

      // A seeded name also gets that person's photo.
      type(input(tree, "identity-name"), "Kevin");
      expect(avatarOptionIds(tree)).toContain("avatar-option-portrait");
    }
  );

  it.each(entries)(
    "%s: Continue needs an avatar pick as well as a name",
    async (_label, entry) => {
      const tree = await renderForm(await openedForm(await entry()));
      type(input(tree, "identity-name"), "Nova");
      expect(continueButton(tree).props.disabled).toBe(true);
      expect(
        tree.root
          .findAllByType(TouchableOpacity)
          .filter((node) => String(node.props.testID ?? "").startsWith("avatar-option-"))
          .every((node) => node.props.accessibilityState?.selected === false)
      ).toBe(true);

      press(touchable(tree, "avatar-option-m-calm"));
      expect(
        touchable(tree, "avatar-option-m-calm").props.accessibilityState
      ).toEqual({ selected: true });
      expect(continueButton(tree).props.disabled).toBeFalsy();

      // Switching gender keeps the pick visible and selected.
      press(touchable(tree, "identity-gender"));
      press(touchable(tree, "identity-gender-Female"));
      expect(avatarOptionIds(tree)).toEqual([
        "avatar-option-look",
        "avatar-option-f-bangs",
        "avatar-option-f-long",
        "avatar-option-m-calm",
      ]);
      expect(
        touchable(tree, "avatar-option-m-calm").props.accessibilityState
      ).toEqual({ selected: true });
      expect(continueButton(tree).props.disabled).toBeFalsy();

      press(touchable(tree, "avatar-option-look"));
      expect(
        touchable(tree, "avatar-option-look").props.accessibilityState
      ).toEqual({ selected: true });
    }
  );

  it.each(entries)(
    "%s: birthday auto-slashes as mm/dd/yyyy while typing",
    async (_label, entry) => {
      const tree = await renderForm(await openedForm(await entry()));

      type(input(tree, "identity-birthday"), "12112001");
      expect(input(tree, "identity-birthday").props.value).toBe("12/11/2001");
      type(input(tree, "identity-birthday"), "1211");
      expect(input(tree, "identity-birthday").props.value).toBe("12/11");
    }
  );

  it.each(entries)(
    "%s: same birthday rule — empty may continue, a malformed date may not",
    async (_label, entry) => {
      const tree = await renderForm(await openedForm(await entry()));
      type(input(tree, "identity-name"), "Kevin");
      press(touchable(tree, "avatar-option-look"));

      expect(continueButton(tree).props.disabled).toBeFalsy();
      expect(texts(tree)).not.toContain("Use mm/dd/yyyy");

      type(input(tree, "identity-birthday"), "13/45/2020");
      expect(continueButton(tree).props.disabled).toBe(true);
      expect(texts(tree)).toContain("Use mm/dd/yyyy");

      type(input(tree, "identity-birthday"), "02/30/2001");
      expect(continueButton(tree).props.disabled).toBe(true);

      type(input(tree, "identity-birthday"), "12/11/2001");
      expect(continueButton(tree).props.disabled).toBeFalsy();

      type(input(tree, "identity-birthday"), "");
      expect(continueButton(tree).props.disabled).toBeFalsy();
    }
  );

  it.each(entries)("%s: a name is required", async (_label, entry) => {
    const tree = await renderForm(await openedForm(await entry()));
    press(touchable(tree, "avatar-option-look"));

    expect(continueButton(tree).props.disabled).toBe(true);
    type(input(tree, "identity-name"), "   ");
    expect(continueButton(tree).props.disabled).toBe(true);
    type(input(tree, "identity-name"), "Kevin");
    expect(continueButton(tree).props.disabled).toBeFalsy();
  });

  it.each(entries)(
    "%s: description is the persona story, capped at 3000",
    async (_label, entry) => {
      const tree = await renderForm(await openedForm(await entry()));

      type(input(tree, "identity-description"), "Likes late-night talks.");
      expect(input(tree, "identity-description").props.value).toBe(
        "Likes late-night talks."
      );
      expect(texts(tree)).toContain("23/3000");
      type(input(tree, "identity-description"), "x".repeat(3005));
      expect(input(tree, "identity-description").props.value).toHaveLength(
        3000
      );
    }
  );
});

describe("creating a companion saves the avatar pick and the gender", () => {
  type WizardApi = ReturnType<typeof useAvatarWizard>;
  type ChatApi = ReturnType<typeof useChat>;
  type CompanionsApi = ReturnType<typeof useCompanions>;
  let wizard: WizardApi | null = null;
  let chat: ChatApi | null = null;
  let companionsApi: CompanionsApi | null = null;
  let save: (() => Companion) | null = null;

  const Probe = () => {
    wizard = useAvatarWizard();
    chat = useChat();
    companionsApi = useCompanions();
    save = useSaveCompanion();
    return null;
  };

  const mountCreator = async () => {
    const form = await openedForm(await homePlusEntry());
    expect(form.initialDraft.avatar).toBeNull();
    mockNavigation = fakeNavigation(fakeNavigation());
    return mount(
      <AvatarWizardProvider
        mode="create"
        companionId="companion-nova"
        initialDraft={form.initialDraft}
      >
        <Probe />
      </AvatarWizardProvider>
    );
  };

  beforeEach(() => {
    wizard = null;
    chat = null;
    companionsApi = null;
    save = null;
  });

  it("the portrait picked on the Identity page is the thread's face after save", async () => {
    await mountCreator();
    act(() => {
      wizard!.patchDraft({ name: "Nova", gender: "Female", avatar: "f-long" });
    });
    act(() => {
      save!();
    });
    await settle();

    const nova = chat!.getThread("companion-nova")!;
    expect(nova).toMatchObject({ name: "Nova", gender: "Female", avatar: "f-long" });
    const record = companionsApi!.companions.find((item) => item.id === "companion-nova")!;
    expect(record.gender).toBe("Female");
    expect(
      companionFace({ thread: nova, companion: record })
    ).toMatchObject({ kind: "f-long", look: null });
  });

  it("picking the 3D look keeps the crafted cartoon as the face", async () => {
    await mountCreator();
    act(() => {
      wizard!.patchDraft({ name: "Nova", avatar: "look" });
    });
    act(() => {
      save!();
    });
    await settle();
    expect(chat!.getThread("companion-nova")?.avatar).toBe("look");
  });

  it("gender is stored on the companion but never changes the 3D craft, which stays the male GLB", async () => {
    await mountCreator();
    act(() => {
      wizard!.patchDraft({ name: "Nova", gender: "Non-binary", avatar: "nb-short" });
    });
    let saved: Companion | null = null;
    act(() => {
      saved = save!();
    });
    await settle();
    expect(saved!.gender).toBe("Non-binary");
    expect(chat!.getThread("companion-nova")?.gender).toBe("Non-binary");
    // The look is the same set of sliders whatever the gender says...
    const asMale: Companion = { ...saved!, gender: "Male" };
    expect(pickLook(saved!)).toEqual(pickLook(asMale));
    expect(Object.keys(DEFAULT_LOOK)).not.toContain("gender");
    // ...and the viewer has exactly one body to load.
    const viewer = readFileSync(
      join(__dirname, "../assets/avatar-engine/viewer-page.html"),
      "utf8"
    );
    expect(viewer.match(/"[^"\n]*\.glb[^"\n]*"/g)).toEqual([
      '"bozo-male.glb?v=bozo24"',
    ]);
    expect(viewer).not.toMatch(/gender/i);
  });
});

describe("one birthday rule", () => {
  it("accepts empty or a real calendar date written mm/dd/yyyy", () => {
    expect(isPlausibleBirthday("")).toBe(true);
    expect(isPlausibleBirthday("   ")).toBe(true);
    expect(isPlausibleBirthday("12/11/2001")).toBe(true);
    expect(isPlausibleBirthday("2/9/1999")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isPlausibleBirthday("1990")).toBe(false);
    expect(isPlausibleBirthday("12/11")).toBe(false);
    expect(isPlausibleBirthday("13/45/2020")).toBe(false);
    expect(isPlausibleBirthday("02/30/2001")).toBe(false);
    expect(isPlausibleBirthday("2001-12-11")).toBe(false);
    expect(isPlausibleBirthday("13th April 2001")).toBe(false);
  });
});

describe("Chat settings → Edit persona on a chat-only bot", () => {
  it("opens the same Identity form, seeded from the thread", async () => {
    const entry = await chatSettingsEditEntry("kevin");
    expect(entry).toEqual({
      name: AVATAR_STACK,
      params: { mode: "editPersona", companionId: "kevin" },
    });

    const form = await openedForm(entry);
    expect(form.initialRoute).toBe(AVATAR_IDENTITY);
    expect(form.component).toBe(AvatarIdentityScreen);
    expect(form.initialDraft).toMatchObject({
      name: "Kevin",
      gender: "Male",
      birthday: "05/25/1976",
    });

    const tree = await renderForm(form);
    expect(input(tree, "identity-name").props.value).toBe("Kevin");
    expect(input(tree, "identity-birthday").props.value).toBe("05/25/1976");
    // Same rule as create: break the birthday and Continue locks.
    type(input(tree, "identity-birthday"), "13/45/2020");
    expect(continueButton(tree).props.disabled).toBe(true);
  });
});

describe("saving an edit for a bot that has no 3D companion", () => {
  type WizardApi = ReturnType<typeof useAvatarWizard>;
  type ChatApi = ReturnType<typeof useChat>;
  type CompanionsApi = ReturnType<typeof useCompanions>;
  let wizard: WizardApi | null = null;
  let chat: ChatApi | null = null;
  let companionsApi: CompanionsApi | null = null;
  let save: (() => Companion) | null = null;

  const Probe = () => {
    wizard = useAvatarWizard();
    chat = useChat();
    companionsApi = useCompanions();
    save = useSaveCompanion();
    return null;
  };

  const mountEditor = async (threadId: string) => {
    const form = await openedForm({
      name: AVATAR_STACK,
      params: { mode: "editPersona", companionId: threadId },
    });
    mockNavigation = fakeNavigation(fakeNavigation());
    return mount(
      <AvatarWizardProvider
        mode="editPersona"
        companionId={form.companionId}
        initialDraft={form.initialDraft}
      >
        <Probe />
      </AvatarWizardProvider>
    );
  };

  beforeEach(() => {
    wizard = null;
    chat = null;
    companionsApi = null;
    save = null;
  });

  it("updates the thread's basic info and does not mint a default-look companion", async () => {
    await mountEditor("kevin");
    const before = chat!.getThread("kevin")!;

    act(() => {
      wizard!.patchDraft({
        name: "Kev",
        birthday: "12/11/2001",
        story: "Rewritten on the Identity page.",
      });
    });
    act(() => {
      save!();
    });
    await settle();

    const kevin = chat!.getThread("kevin")!;
    expect(kevin).toMatchObject({
      name: "Kev",
      gender: "Male",
      birthday: "12/11/2001",
      description: "Rewritten on the Identity page.",
    });
    // Untouched persona traits keep the seeded free-text personality.
    expect(kevin.personality).toBe(before.personality);
    expect(companionsApi!.companions).toEqual([]);
  });

  it("writes picked personality traits to the thread when they were changed", async () => {
    await mountEditor("kevin");

    act(() => {
      wizard!.patchDraft({ personalities: ["Playful & whimsical"] });
    });
    act(() => {
      save!();
    });
    await settle();

    expect(chat!.getThread("kevin")!.personality).toBe("Playful & whimsical");
    expect(companionsApi!.companions).toEqual([]);
  });

  it("Edit persona on chat-only Kevin offers his photo and the male portraits, no 3D look, and saves the pick", async () => {
    const form = await openedForm({
      name: AVATAR_STACK,
      params: { mode: "editPersona", companionId: "kevin" },
    });
    // Seeded Kevin wears his photo today, so that is what opens selected.
    expect(form.initialDraft.avatar).toBe("portrait");
    const tree = await renderForm(form);
    expect(avatarOptionIds(tree)).toEqual([
      "avatar-option-portrait",
      "avatar-option-m-warm",
      "avatar-option-m-calm",
      "avatar-option-m-tousled",
    ]);
    expect(
      touchable(tree, "avatar-option-portrait").props.accessibilityState
    ).toEqual({ selected: true });
    // Editing does not lock Continue behind a re-pick.
    expect(continueButton(tree).props.disabled).toBeFalsy();

    await mountEditor("kevin");
    act(() => {
      wizard!.patchDraft({ avatar: "m-warm" });
    });
    act(() => {
      save!();
    });
    await settle();
    expect(chat!.getThread("kevin")?.avatar).toBe("m-warm");
    expect(companionsApi!.companions).toEqual([]);
  });

  it("still saves a real companion record for a person that has one", async () => {
    // What the create wizard leaves behind, hydrated by CompanionsProvider.
    const nova: Companion = {
      ...DEFAULT_DRAFT,
      id: "created-nova",
      name: "Nova",
      birthday: "01/01/2000",
      gender: "Male",
      personalities: ["Playful & whimsical"],
      story: "Made in the avatar wizard.",
    };
    await saveCompanions("demo", {
      companions: [nova],
      activeCompanionId: null,
    });

    const form = await openedForm({
      name: AVATAR_STACK,
      params: { mode: "editPersona", companionId: nova.id },
    });
    expect(form.initialDraft.name).toBe("Nova");

    mockNavigation = fakeNavigation(fakeNavigation());
    await mount(
      <AvatarWizardProvider
        mode="editPersona"
        companionId={form.companionId}
        initialDraft={form.initialDraft}
      >
        <Probe />
      </AvatarWizardProvider>
    );
    act(() => {
      wizard!.patchDraft({ story: "Edited." });
    });
    act(() => {
      save!();
    });
    await settle();

    expect(
      companionsApi!.companions.find((item) => item.id === nova.id)?.story
    ).toBe("Edited.");
    expect(chat!.getThread(nova.id)?.description).toBe("Edited.");
  });
});
