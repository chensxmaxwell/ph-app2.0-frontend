import type { ChatThread } from "./types";

// The one rule for who counts as a Message friend. The inbox rows and Home
// "My Companions" both read it, so a person is either on both screens or on
// neither: deleting a friend (thread dropped + id tombstoned in the chat
// store) removes them from Home in the same render.
export const isMessageFriend = (thread: ChatThread) =>
  thread.request !== "refused";

// Inbox order: pinned rows first, otherwise the store's order (newest thread
// first, then the seeds).
export const messageFriends = (threads: ChatThread[]): ChatThread[] =>
  threads
    .filter(isMessageFriend)
    .sort((left, right) => Number(right.pinned) - Number(left.pinned));
