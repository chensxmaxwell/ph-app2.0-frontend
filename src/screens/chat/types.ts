export type ChatKind = "bot" | "human";

export type FriendRequest = "none" | "incoming" | "sent" | "accepted" | "refused";

export type ChatBubble = {
  id: string;
  from: "them" | "me";
  text: string;
  // Epoch milliseconds (Date.now()) when the bubble was sent. The display
  // string ("now", "3 min ago", "2:14 PM", "Yesterday"...) is derived from
  // this at render time and never stored.
  sentAt: number;
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
  // Epoch milliseconds of the last message or request event; this is what the
  // Message list row's time label is formatted from.
  lastActivityAt: number;
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
