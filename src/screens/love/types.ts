export type LoveLayer = "chat" | "call" | "sync";

export type LoveMode = "none" | "pattern" | "kink" | "bliss";

export type LoveBubble = {
  kind: "bubble";
  id: string;
  from: "them" | "me";
  text: string;
  synced?: boolean;
};

export type LoveSyncLine = {
  kind: "sync";
  id: string;
};

export type LoveChatItem = LoveBubble | LoveSyncLine;

export type LoveChatState = {
  companionId?: string;
  name: string;
  messages: LoveChatItem[];
  synced: boolean;
  inCall: boolean;
  listen: boolean;
  pinned: boolean;
  mode: LoveMode;
};
