import { graphql, GraphQLSchema } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { typeDefs } from "../src/backend/schema";
import { resolvers } from "../src/backend/resolvers";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const schema: GraphQLSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const run = (
  source: string,
  variables?: Record<string, unknown>,
  token?: string
) =>
  graphql({
    schema,
    source,
    variableValues: variables,
    contextValue: { token: token || "" },
  });

const REGISTER = `
  mutation Register($email: String!, $password: String!) {
    registerUser(registerInput: { email: $email, password: $password }) {
      id
      email
      token
    }
  }
`;

const LOGIN = `
  mutation Login($email: String!, $password: String!) {
    loginUser(loginInput: { email: $email, password: $password }) {
      id
      email
      token
    }
  }
`;

const POST = `
  mutation Post($threadId: ID!, $message: ChatBubbleInput!) {
    postChatMessage(threadId: $threadId, message: $message) {
      id
      preview
      lastActivityAt
      messages {
        id
        from
        text
        sentAt
        voice
      }
    }
  }
`;

const THREADS = `
  query Threads {
    chatThreads {
      id
      name
      messages {
        id
        from
        text
        voice
      }
    }
  }
`;

describe("on-device GraphQL backend", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("seeds demo login and rejects a bad password", async () => {
    const bad = await run(LOGIN, {
      email: "demo@local",
      password: "nope",
    });
    expect(bad.errors?.[0]?.extensions?.code).toBe("INCORRECT_PASSWORD");

    const ok = await run(LOGIN, {
      email: "demo@local",
      password: "demo1234",
    });
    expect(ok.errors).toBeUndefined();
    expect(ok.data?.loginUser).toMatchObject({
      id: "demo",
      email: "demo@local",
    });
    expect(ok.data?.loginUser.token).toBeTruthy();
  });

  it("register / login / postChatMessage / chatThreads roundtrip", async () => {
    const registered = await run(REGISTER, {
      email: "max@local",
      password: "secret12",
    });
    expect(registered.errors).toBeUndefined();
    const token = registered.data?.registerUser.token as string;
    expect(token).toBeTruthy();

    const login = await run(LOGIN, {
      email: "max@local",
      password: "secret12",
    });
    expect(login.errors).toBeUndefined();
    expect(login.data?.loginUser.email).toBe("max@local");

    const posted = await run(
      POST,
      {
        threadId: "kevin",
        message: { from: "me", text: "still here after relaunch", voice: false },
      },
      token
    );
    expect(posted.errors).toBeUndefined();
    expect(posted.data?.postChatMessage.preview).toBe(
      "still here after relaunch"
    );
    const voices = posted.data?.postChatMessage.messages.map(
      (item: { voice?: boolean }) => item.voice
    );
    expect(voices.some((value: boolean) => value === true)).toBe(false);
    // A posted message is stamped with a real epoch, and every bubble in the
    // thread (seeded ones included) carries one.
    const before = Date.now();
    const postedThread = posted.data?.postChatMessage as {
      lastActivityAt: number;
      messages: { sentAt: number }[];
    };
    const stamped = postedThread.messages[postedThread.messages.length - 1];
    expect(typeof stamped.sentAt).toBe("number");
    expect(stamped.sentAt).toBeLessThanOrEqual(before);
    expect(stamped.sentAt).toBeGreaterThan(before - 60_000);
    expect(postedThread.lastActivityAt).toBe(stamped.sentAt);
    for (const item of postedThread.messages) {
      expect(typeof item.sentAt).toBe("number");
    }

    const listed = await run(THREADS, undefined, token);
    expect(listed.errors).toBeUndefined();
    const kevin = listed.data?.chatThreads.find(
      (item: { id: string }) => item.id === "kevin"
    );
    expect(kevin.messages.map((item: { text: string }) => item.text)).toContain(
      "still here after relaunch"
    );
    expect(listed.data?.chatThreads.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(["kevin", "chad", "amanda"])
    );
  });

  it("keeps chat and companions scoped to the logged-in user", async () => {
    const a = await run(REGISTER, {
      email: "a@local",
      password: "secret12",
    });
    const tokenA = a.data?.registerUser.token as string;
    await run(
      POST,
      {
        threadId: "kevin",
        message: { from: "me", text: "only for account A" },
      },
      tokenA
    );

    const companion = await run(
      `
      mutation Upsert($input: CompanionInput!) {
        upsertCompanion(input: $input) {
          id
          name
          userId
        }
      }
    `,
      {
        input: {
          id: "custom-bot",
          name: "Created Kevin",
          story: "A custom companion.",
          payload: JSON.stringify({ id: "custom-bot", name: "Created Kevin" }),
        },
      },
      tokenA
    );
    expect(companion.errors).toBeUndefined();

    const b = await run(REGISTER, {
      email: "b@local",
      password: "secret12",
    });
    const tokenB = b.data?.registerUser.token as string;
    const bThreads = await run(THREADS, undefined, tokenB);
    const bKevin = bThreads.data?.chatThreads.find(
      (item: { id: string }) => item.id === "kevin"
    );
    expect(
      bKevin.messages.map((item: { text: string }) => item.text)
    ).not.toContain("only for account A");

    const bCompanions = await run(
      `query { companions { id name } }`,
      undefined,
      tokenB
    );
    expect(bCompanions.data?.companions).toEqual([]);

    const aAgain = await run(THREADS, undefined, tokenA);
    const aKevin = aAgain.data?.chatThreads.find(
      (item: { id: string }) => item.id === "kevin"
    );
    expect(aKevin.messages.map((item: { text: string }) => item.text)).toContain(
      "only for account A"
    );
    const aCompanions = await run(
      `query { companions { id name } }`,
      undefined,
      tokenA
    );
    expect(aCompanions.data?.companions).toEqual([
      expect.objectContaining({ id: "custom-bot", name: "Created Kevin" }),
    ]);
  });

  it("accepts OTP 000000 or a 6-digit code", async () => {
    const ok = await run(`mutation { verifyOTP(otp: "000000") }`);
    expect(ok.data?.verifyOTP).toBe(true);
    const resend = await run(
      `mutation { resendOTPVerificationCode(email: "max@local") }`
    );
    expect(resend.data?.resendOTPVerificationCode).toBe(true);
  });
});
