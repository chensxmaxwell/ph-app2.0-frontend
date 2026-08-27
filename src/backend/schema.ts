export const typeDefs = `
  type User {
    id: ID!
    email: String
    token: String
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

  type DeviceSettings {
    intensity: Int
    mode: String
  }

  type DeviceData {
    timeStamp: String
    data: String
  }

  type Device {
    id: ID!
    userId: ID
    name: String
    peripheralID: String
    settings: DeviceSettings
    userData: [DeviceData]
    userOnboardingData: [DeviceData]
  }

  type ChatBubble {
    id: ID!
    from: String!
    text: String!
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
    time: String
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

  type RecordItem {
    id: ID!
    userId: ID
    kind: String!
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

  input UpdateDeviceInput {
    timeStamp: String
    data: String
  }

  input ChatBubbleInput {
    id: ID
    from: String!
    text: String!
    voice: Boolean
    edited: Boolean
    synced: Boolean
  }

  input ChatThreadInput {
    id: ID
    name: String
    kind: String
    email: String
    preview: String
    time: String
    pinned: Boolean
    listen: Boolean
    synced: Boolean
    request: String
    gender: String
    birthday: String
    description: String
    personality: String
    messages: [ChatBubbleInput]
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
    chatThread(id: ID!): ChatThread
    companions: [Companion]
    companion(id: ID!): Companion
    records(kind: String): [RecordItem]
  }

  type Mutation {
    loginUser(loginInput: LoginInput!): User
    loginGoogleUser(loginGoogleInput: LoginGoogleInput!): User
    registerUser(registerInput: RegisterInput!): User
    addUserProfile(input: UserProfileInput!): UserProfile
    updateUserProfile(input: UserProfileInput!): UserProfile
    updateDevice(
      userData: [UpdateDeviceInput]
      userOnboardingData: [UpdateDeviceInput]
    ): Device
    verifyOTP(otp: String): Boolean
    resendOTPVerificationCode(email: String): Boolean
    upsertChatThread(input: ChatThreadInput!): ChatThread
    postChatMessage(threadId: ID!, message: ChatBubbleInput!): ChatThread
    deleteChatThread(id: ID!): Boolean
    upsertCompanion(input: CompanionInput!): Companion
    deleteCompanion(id: ID!): Boolean
    putRecord(kind: String!, id: ID, payload: String): RecordItem
    deleteRecord(id: ID!): Boolean
  }
`;
