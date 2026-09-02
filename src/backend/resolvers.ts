import { GraphQLError } from "graphql";
import { getSessionUser, readSessionUser, writeSessionUser } from "./session";
import {
  LocalProfile,
  LocalUser,
  appendMessage,
  ensureSeeded,
  findUserByEmail,
  findUserByToken,
  getProfile,
  getUsers,
  hashPassword,
  listChatThreads,
  loadCompanions,
  loginAndSession,
  nextId,
  publicUser,
  resetPasswordForEmail,
  setProfile,
  setUsers,
  upsertCompanionRow,
} from "./store";

type Ctx = { token?: string };

const passwordError = () =>
  new GraphQLError("Incorrect password or user does not exist.", {
    extensions: { code: "INCORRECT_PASSWORD" },
  });

const requireUser = async (ctx: Ctx): Promise<LocalUser> => {
  await ensureSeeded();
  const token =
    ctx?.token ||
    getSessionUser()?.token ||
    (await readSessionUser())?.token ||
    "";
  const user = await findUserByToken(token);
  if (!user) {
    throw new GraphQLError("Unauthorized", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return user;
};

const mergePersonalInfo = (
  current: LocalProfile["personalInfo"] | undefined,
  input: LocalProfile["personalInfo"] | undefined
) => ({
  age: input?.age ?? current?.age,
  height: input?.height ?? current?.height,
  weight: input?.weight ?? current?.weight,
  biographicalInfo: input?.biographicalInfo ?? current?.biographicalInfo,
  sexualOrientation: input?.sexualOrientation ?? current?.sexualOrientation,
  birthday: input?.birthday ?? current?.birthday,
});

const upsertProfile = async (userId: string, input: Partial<LocalProfile>) => {
  const existing = await getProfile(userId);
  const next: LocalProfile = {
    userId,
    nickName: input.nickName ?? existing?.nickName,
    profilePicture: input.profilePicture ?? existing?.profilePicture,
    personalInfo: mergePersonalInfo(existing?.personalInfo, input.personalInfo),
  };
  await setProfile(next);
  return next;
};

export const resolvers = {
  Query: {
    currentUser: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await findUserByToken(
        ctx?.token || getSessionUser()?.token || (await readSessionUser())?.token
      );
      return user ? publicUser(user) : null;
    },
    getUserProfile: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await requireUser(ctx);
      return getProfile(user.id);
    },
    getDeviceByUser: async () => null,
    chatThreads: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await requireUser(ctx);
      return listChatThreads(user.id);
    },
    companions: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await requireUser(ctx);
      const blob = await loadCompanions(user.id);
      return blob.companions.map((item) => ({
        ...item,
        userId: user.id,
        payload: JSON.stringify(item),
      }));
    },
  },
  Mutation: {
    loginUser: async (
      _: unknown,
      args: { loginInput: { email: string; password: string } }
    ) => {
      await ensureSeeded();
      const user = await findUserByEmail(args.loginInput.email);
      if (!user || user.passwordHash !== hashPassword(args.loginInput.password)) {
        throw passwordError();
      }
      return loginAndSession(user);
    },
    loginGoogleUser: async (
      _: unknown,
      args: { loginGoogleInput: { token?: string; platform?: string } }
    ) => {
      await ensureSeeded();
      const token = args.loginGoogleInput?.token || nextId("google");
      const marker = hashPassword(token).slice(-10);
      const email = `google-${marker}@local`;
      let user = await findUserByEmail(email);
      if (!user) {
        user = {
          id: nextId("google"),
          email,
          token: `local.${marker}`,
          passwordHash: hashPassword(token),
          google: true,
          nickName: "Google User",
        };
        const users = await getUsers();
        await setUsers([...users, user]);
      }
      return loginAndSession(user);
    },
    registerUser: async (
      _: unknown,
      args: { registerInput: { email: string; password: string } }
    ) => {
      await ensureSeeded();
      const email = args.registerInput.email.trim().toLowerCase();
      if (!email || !args.registerInput.password) {
        throw new GraphQLError("Email and password are required.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const existing = await findUserByEmail(email);
      if (existing) {
        throw new GraphQLError("An account with this email already exists.", {
          extensions: { code: "USER_EXISTS" },
        });
      }
      const id = nextId("user");
      const nickName = email.split("@")[0] || "User";
      const user: LocalUser = {
        id,
        email,
        token: `local.${id}`,
        passwordHash: hashPassword(args.registerInput.password),
        nickName,
      };
      const users = await getUsers();
      await setUsers([...users, user]);
      await setProfile({
        userId: id,
        nickName,
        personalInfo: { birthday: "01/01/2000" },
      });
      return loginAndSession(user);
    },
    addUserProfile: async (
      _: unknown,
      args: { input: LocalProfile },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      return upsertProfile(user.id, args.input);
    },
    updateUserProfile: async (
      _: unknown,
      args: { input: LocalProfile },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      return upsertProfile(user.id, args.input);
    },
    verifyOTP: async (_: unknown, args: { otp?: string }) => {
      const code = (args.otp || "").trim();
      if (code === "000000" || /^\d{6}$/.test(code) || code.length === 0) {
        return true;
      }
      throw new GraphQLError("Code invalid or does not exist.", {
        extensions: { code: "INVALID_OTP" },
      });
    },
    resendOTPVerificationCode: async () => true,
    resetPassword: async (
      _: unknown,
      args: { email: string; newPassword: string }
    ) => {
      const ok = await resetPasswordForEmail(args.email, args.newPassword);
      if (!ok) {
        throw new GraphQLError("No account for that email.", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return true;
    },
    postChatMessage: async (
      _: unknown,
      args: {
        threadId: string;
        message: {
          id?: string;
          from: "them" | "me";
          text: string;
          sentAt?: number;
          voice?: boolean;
        };
      },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      return appendMessage(user.id, args.threadId, args.message);
    },
    upsertCompanion: async (
      _: unknown,
      args: { input: any },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      let payload = args.input;
      if (args.input?.payload) {
        try {
          payload = { ...JSON.parse(args.input.payload), ...args.input };
        } catch {
          payload = args.input;
        }
      }
      const saved = await upsertCompanionRow(user.id, payload);
      return { ...saved, userId: user.id, payload: JSON.stringify(saved) };
    },
  },
};
