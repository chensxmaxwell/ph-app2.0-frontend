export const typeDefs = `
  type User {
    id: ID!
    email: String
    token: String
    nickName: String
  }

  type PersonalInfo {
    age: String
    height: String
    weight: String
    biographicalInfo: String
    sexualOrientation: String
    birthday: String
  }

  type UserProfile {
    userId: ID
    nickName: String
    profilePicture: String
    personalInfo: PersonalInfo
  }

  type Device {
    id: ID!
    name: String
    peripheralID: String
  }

  type ChatBubble {
    id: ID!
    from: String!
    text: String!
    sentAt: Float!
    voice: Boolean
    edited: Boolean
    synced: Boolean
  }

  type ChatThread {
    id: ID!
    name: String
    kind: String
    email: String
    preview: String
    lastActivityAt: Float
    pinned: Boolean
    listen: Boolean
    synced: Boolean
    request: String
    gender: String
    birthday: String
    description: String
    personality: String
    messages: [ChatBubble]
  }

  type Companion {
    id: ID!
    userId: ID
    name: String
    gender: String
    birthday: String
    personalities: [String]
    story: String
    passionateTender: Float
    dominantSubmissive: Float
    experimentalVanilla: Float
    payload: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input LoginGoogleInput {
    token: String
    platform: String
  }

  input RegisterInput {
    email: String!
    password: String!
  }

  input PersonalInfoInput {
    age: String
    height: String
    weight: String
    biographicalInfo: String
    sexualOrientation: String
    birthday: String
  }

  input UserProfileInput {
    nickName: String
    profilePicture: String
    personalInfo: PersonalInfoInput
  }

  input ChatBubbleInput {
    id: ID
    from: String!
    text: String!
    sentAt: Float
    voice: Boolean
    edited: Boolean
    synced: Boolean
  }

  input CompanionInput {
    id: ID
    name: String
    gender: String
    birthday: String
    personalities: [String]
    story: String
    passionateTender: Float
    dominantSubmissive: Float
    experimentalVanilla: Float
    payload: String
  }

  type Query {
    currentUser: User
    getUserProfile: UserProfile
    getDeviceByUser: Device
    chatThreads: [ChatThread]
    companions: [Companion]
  }

  type Mutation {
    loginUser(loginInput: LoginInput!): User
    loginGoogleUser(loginGoogleInput: LoginGoogleInput!): User
    registerUser(registerInput: RegisterInput!): User
    addUserProfile(input: UserProfileInput!): UserProfile
    updateUserProfile(input: UserProfileInput!): UserProfile
    verifyOTP(otp: String): Boolean
    resendOTPVerificationCode(email: String): Boolean
    resetPassword(email: String!, newPassword: String!): Boolean
    postChatMessage(threadId: ID!, message: ChatBubbleInput!): ChatThread
    upsertCompanion(input: CompanionInput!): Companion
  }
`;
