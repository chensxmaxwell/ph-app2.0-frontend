import type { PortraitId } from "../avatar/portraits";

export type ChatKind = "bot" | "human";

export type FriendRequest = "none" | "incoming" | "sent" | "accepted" | "refused";

// Which face a person wears on every surface (Home strip, Message list and
// thread, Love overlays, calls). `look` is the crafted 3D avatar, `portrait`
// the bundled photo a seeded person owns, a PortraitId one of the six
// generated portraits every companion may pick. Unset means the default: the
// crafted look when the person has one, otherwise the portrait.
export type AvatarChoice = "look" | "portrait" | PortraitId;

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
  // The user's avatar pick for this person; see AvatarChoice. Lives on the
  // thread because the thread is the one membership record (a seeded person
  // has no companion record) and dies with "Delete friend".
  avatar?: AvatarChoice;
  // The Doubao speaker this person talks with on calls and in Listen (see
  // src/services/voices.ts). Drawn from the gender's pool when the character
  // is created; seeded people carry a fixed one. Optional so blobs from
  // before voices existed still parse (they resolve through voiceForPerson).
  voiceId?: string;
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
