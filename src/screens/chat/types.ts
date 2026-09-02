export type ChatKind = "bot" | "human";

export type FriendRequest = "none" | "incoming" | "sent" | "accepted" | "refused";

export type ChatBubble = {
  id: string;
  from: "them" | "me";
  text: string;
  voice?: boolean;
  edited?: boolean;
  synced?: boolean;
};

export type ChatThread = {
  id: string;
  name: string;
  kind: ChatKind;
  email?: string;
  preview: string;
  time: string;
  pinned: boolean;
  listen: boolean;
  synced: boolean;
  // Set by the Message list swipe action; cleared when the thread is opened.
  // Optional so blobs persisted before the flag existed still parse as read.
  unread?: boolean;
  request: FriendRequest;
  gender?: string;
  birthday?: string;
  description?: string;
  personality?: string;
  messages: ChatBubble[];
};

export type DirectoryPerson = {
  id: string;
  name: string;
  email: string;
  gender: string;
  birthday: string;
  plan: string;
};
