import { graphql, GraphQLSchema } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { typeDefs } from "../src/backend/schema";
import { resolvers } from "../src/backend/resolvers";
import { writeSessionUser } from "../src/backend/session";
import { STORE_KEYS, scopedKey } from "../src/backend/session";

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
      messages {
        id
        from
        text
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
      }
    }
  }
`;

const COMPANIONS = `
  query Companions {
    companions {
      id
      name
    }
  }
`;

const UPSERT_COMPANION = `
  mutation Upsert($input: CompanionInput!) {
    upsertCompanion(input: $input) {
      id
      name
    }
  }
`;

describe("on-device accounts and user data", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await writeSessionUser(null);
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
  });

  it("register, login, post chat, logout, other account is isolated, original data returns", async () => {
    const registered = await run(REGISTER, {
      email: "a@local",
      password: "secret12",
    });
    expect(registered.errors).toBeUndefined();
    const tokenA = registered.data?.registerUser.token as string;
    const idA = registered.data?.registerUser.id as string;

    const login = await run(LOGIN, {
      email: "a@local",
      password: "secret12",
    });
    expect(login.errors).toBeUndefined();

    const posted = await run(
      POST,
      {
        threadId: "kevin",
        message: { from: "me", text: "only for account A" },
      },
      tokenA
    );
    expect(posted.errors).toBeUndefined();

    const companion = await run(
      UPSERT_COMPANION,
      {
        input: {
          id: "custom-bot",
          name: "Created Kevin",
          payload: JSON.stringify({ id: "custom-bot", name: "Created Kevin" }),
        },
      },
      tokenA
    );
    expect(companion.errors).toBeUndefined();

    await writeSessionUser(null);

    const b = await run(REGISTER, {
      email: "b@local",
      password: "secret12",
    });
    expect(b.errors).toBeUndefined();
    const tokenB = b.data?.registerUser.token as string;

    const bThreads = await run(THREADS, undefined, tokenB);
    const bKevin = bThreads.data?.chatThreads.find(
      (item: { id: string }) => item.id === "kevin"
    );
    expect(
      (bKevin?.messages || []).map((item: { text: string }) => item.text)
    ).not.toContain("only for account A");

    const bCompanions = await run(COMPANIONS, undefined, tokenB);
    expect(bCompanions.data?.companions).toEqual([]);

    await writeSessionUser(null);

    const aAgainLogin = await run(LOGIN, {
      email: "a@local",
      password: "secret12",
    });
    expect(aAgainLogin.errors).toBeUndefined();
    const aAgain = await run(THREADS, undefined, tokenA);
    const aKevin = aAgain.data?.chatThreads.find(
      (item: { id: string }) => item.id === "kevin"
    );
    expect(aKevin.messages.map((item: { text: string }) => item.text)).toContain(
      "only for account A"
    );
    const aCompanions = await run(COMPANIONS, undefined, tokenA);
    expect(aCompanions.data?.companions).toEqual([
      expect.objectContaining({ id: "custom-bot", name: "Created Kevin" }),
    ]);

    const scopedChat = await AsyncStorage.getItem(
      scopedKey(STORE_KEYS.chat, idA)
    );
    expect(scopedChat).toContain("only for account A");
  });

  it("forgot-password confirm changes the stored password", async () => {
    await run(REGISTER, {
      email: "reset@local",
      password: "oldpass1",
    });
    const reset = await run(
      `mutation { resetPassword(email: "reset@local", newPassword: "newpass1") }`
    );
    expect(reset.errors).toBeUndefined();
    expect(reset.data?.resetPassword).toBe(true);

    const oldLogin = await run(LOGIN, {
      email: "reset@local",
      password: "oldpass1",
    });
    expect(oldLogin.errors?.[0]?.extensions?.code).toBe("INCORRECT_PASSWORD");

    const nextLogin = await run(LOGIN, {
      email: "reset@local",
      password: "newpass1",
    });
    expect(nextLogin.errors).toBeUndefined();
    expect(nextLogin.data?.loginUser.email).toBe("reset@local");
  });
});
