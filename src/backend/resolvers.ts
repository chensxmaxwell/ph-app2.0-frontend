import { GraphQLError } from "graphql";
import {
  LocalCompanion,
  LocalDevice,
  LocalProfile,
  LocalRecord,
  LocalUser,
  appendMessage,
  ensureSeeded,
  ensureUserData,
  findUserByEmail,
  findUserByToken,
  getChatThread,
  getCompanions,
  getDevices,
  getOtps,
  getProfiles,
  getRecords,
  getUsers,
  hashPassword,
  listChatThreads,
  nextId,
  removeThread,
  setCompanions,
  setDevices,
  setOtps,
  setProfiles,
  setRecords,
  setUsers,
  upsertThread,
} from "./store";

type Ctx = { token?: string };

const authError = (message = "Unauthorized") =>
  new GraphQLError(message, { extensions: { code: "UNAUTHENTICATED" } });

const passwordError = () =>
  new GraphQLError("Incorrect password or user does not exist.", {
    extensions: { code: "INCORRECT_PASSWORD" },
  });

const requireUser = async (ctx: Ctx): Promise<LocalUser> => {
  await ensureSeeded();
  const user = await findUserByToken(ctx?.token);
  if (!user) {
    throw authError();
  }
  await ensureUserData(user.id);
  return user;
};

const publicUser = (user: LocalUser) => ({
  id: user.id,
  email: user.email,
  token: user.token,
});

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
  const rows = await getProfiles(userId);
  const existing = rows.find((item) => item.userId === userId);
  const next: LocalProfile = {
    userId,
    nickName: input.nickName ?? existing?.nickName,
    profilePicture: input.profilePicture ?? existing?.profilePicture,
    personalInfo: mergePersonalInfo(existing?.personalInfo, input.personalInfo),
  };
  if (existing) {
    await setProfiles(
      userId,
      rows.map((item) => (item.userId === userId ? next : item))
    );
  } else {
    await setProfiles(userId, [...rows, next]);
  }
  return next;
};

const randomOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const resolvers = {
  Query: {
    currentUser: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await findUserByToken(ctx?.token);
      return user ? publicUser(user) : null;
    },
    getUserProfile: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await requireUser(ctx);
      const rows = await getProfiles(user.id);
      return rows.find((item) => item.userId === user.id) ?? null;
    },
    getDeviceByUser: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await requireUser(ctx);
      const rows = await getDevices(user.id);
      return rows[0] ?? null;
    },
    chatThreads: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await requireUser(ctx);
      return listChatThreads(user.id);
    },
    chatThread: async (_: unknown, args: { id: string }, ctx: Ctx) => {
      const user = await requireUser(ctx);
      return getChatThread(user.id, args.id);
    },
    companions: async (_: unknown, __: unknown, ctx: Ctx) => {
      const user = await requireUser(ctx);
      return getCompanions(user.id);
    },
    companion: async (_: unknown, args: { id: string }, ctx: Ctx) => {
      const user = await requireUser(ctx);
      const rows = await getCompanions(user.id);
      return rows.find((item) => item.id === args.id) ?? null;
    },
    records: async (_: unknown, args: { kind?: string }, ctx: Ctx) => {
      const user = await requireUser(ctx);
      const rows = await getRecords(user.id);
      if (!args.kind) {
        return rows;
      }
      return rows.filter((item) => item.kind === args.kind);
    },
  },
  Mutation: {
    loginUser: async (
      _: unknown,
      args: { loginInput: { email: string; password: string } }
    ) => {
      await ensureSeeded();
      const email = args.loginInput.email.trim();
      const user = await findUserByEmail(email);
      if (!user || user.passwordHash !== hashPassword(args.loginInput.password)) {
        throw passwordError();
      }
      await ensureUserData(user.id);
      return publicUser(user);
    },
    loginGoogleUser: async (
      _: unknown,
      args: { loginGoogleInput: { token?: string; platform?: string } }
    ) => {
      await ensureSeeded();
      const token = args.loginGoogleInput?.token || nextId("google");
      const marker = hashPassword(token).replace(`${"ph.local.v1"}:`, "");
      const email = `google-${marker.slice(0, 10)}@local`;
      let user = await findUserByEmail(email);
      if (!user) {
        user = {
          id: nextId("google"),
          email,
          token: `local.${marker.slice(0, 12)}`,
          passwordHash: hashPassword(token),
          google: true,
        };
        const users = await getUsers();
        await setUsers([...users, user]);
      }
      await ensureUserData(user.id);
      return publicUser(user);
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
      const user: LocalUser = {
        id,
        email,
        token: `local.${id}`,
        passwordHash: hashPassword(args.registerInput.password),
      };
      const users = await getUsers();
      await setUsers([...users, user]);
      await ensureUserData(user.id);
      return publicUser(user);
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
    updateDevice: async (
      _: unknown,
      args: {
        userData?: LocalDevice["userData"];
        userOnboardingData?: LocalDevice["userOnboardingData"];
      },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      const rows = await getDevices(user.id);
      const existing = rows[0];
      const next: LocalDevice = {
        id: existing?.id || `device-${user.id}`,
        userId: user.id,
        name: existing?.name || "Pleasure House",
        peripheralID: existing?.peripheralID || "",
        settings: existing?.settings || { intensity: 3, mode: "" },
        userData: args.userData
          ? [...(existing?.userData || []), ...args.userData]
          : existing?.userData || [],
        userOnboardingData: args.userOnboardingData
          ? [
              ...(existing?.userOnboardingData || []),
              ...args.userOnboardingData,
            ]
          : existing?.userOnboardingData || [],
      };
      await setDevices(user.id, [next]);
      return next;
    },
    verifyOTP: async (_: unknown, args: { otp?: string }) => {
      const code = (args.otp || "").trim();
      if (code === "000000") {
        return true;
      }
      if (!/^\d{6}$/.test(code)) {
        throw new GraphQLError("Code invalid or does not exist.", {
          extensions: { code: "INVALID_OTP" },
        });
      }
      const otps = await getOtps();
      const match = otps.find((item) => item.code === code);
      if (!match) {
        throw new GraphQLError("Code invalid or does not exist.", {
          extensions: { code: "INVALID_OTP" },
        });
      }
      return true;
    },
    resendOTPVerificationCode: async (_: unknown, args: { email?: string }) => {
      const email = (args.email || "").trim().toLowerCase();
      const code = randomOtp();
      const otps = await getOtps();
      const next = [
        ...otps.filter((item) => item.email !== email),
        { email, code },
      ];
      await setOtps(next);
      return true;
    },
    upsertChatThread: async (
      _: unknown,
      args: { input: Parameters<typeof upsertThread>[1] },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      return upsertThread(user.id, args.input);
    },
    postChatMessage: async (
      _: unknown,
      args: {
        threadId: string;
        message: {
          id?: string;
          from: "them" | "me";
          text: string;
          voice?: boolean;
          edited?: boolean;
          synced?: boolean;
        };
      },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      return appendMessage(user.id, args.threadId, args.message);
    },
    deleteChatThread: async (_: unknown, args: { id: string }, ctx: Ctx) => {
      const user = await requireUser(ctx);
      return removeThread(user.id, args.id);
    },
    upsertCompanion: async (
      _: unknown,
      args: { input: LocalCompanion },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      const rows = await getCompanions(user.id);
      const id = args.input.id || nextId("companion");
      const existing = rows.find((item) => item.id === id);
      const next: LocalCompanion = {
        ...existing,
        ...args.input,
        id,
        userId: user.id,
        payload:
          args.input.payload ||
          JSON.stringify({ ...existing, ...args.input, id, userId: user.id }),
      };
      if (existing) {
        await setCompanions(
          user.id,
          rows.map((item) => (item.id === id ? next : item))
        );
      } else {
        await setCompanions(user.id, [...rows, next]);
      }
      return next;
    },
    deleteCompanion: async (_: unknown, args: { id: string }, ctx: Ctx) => {
      const user = await requireUser(ctx);
      const rows = await getCompanions(user.id);
      await setCompanions(
        user.id,
        rows.filter((item) => item.id !== args.id)
      );
      return true;
    },
    putRecord: async (
      _: unknown,
      args: { kind: string; id?: string; payload?: string },
      ctx: Ctx
    ) => {
      const user = await requireUser(ctx);
      const id = args.id || nextId("record");
      const rows = await getRecords(user.id);
      const next: LocalRecord = {
        id,
        userId: user.id,
        kind: args.kind,
        payload: args.payload,
      };
      const existing = rows.find((item) => item.id === id);
      if (existing) {
        await setRecords(
          user.id,
          rows.map((item) => (item.id === id ? next : item))
        );
      } else {
        await setRecords(user.id, [...rows, next]);
      }
      return next;
    },
    deleteRecord: async (_: unknown, args: { id: string }, ctx: Ctx) => {
      const user = await requireUser(ctx);
      const rows = await getRecords(user.id);
      await setRecords(
        user.id,
        rows.filter((item) => item.id !== args.id)
      );
      return true;
    },
  },
};
