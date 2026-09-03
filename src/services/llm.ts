import { hasLlmKey, loadLlmConfig } from "./llm-config";

export type LlmTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompanionChatFailureCode =
  | "missing_key"
  | "request_failed"
  | "empty_reply";

type CompanionChatInput = {
  name: string;
  userText: string;
  history: { from: "me" | "them"; text: string }[];
  personality?: string;
  story?: string;
};

export class CompanionChatError extends Error {
  readonly code: CompanionChatFailureCode;

  constructor(code: CompanionChatFailureCode, message: string) {
    super(message);
    this.name = "CompanionChatError";
    this.code = code;
  }
}

const messageForCode = (code: CompanionChatFailureCode): string => {
  switch (code) {
    case "missing_key":
      return "Companion AI isn't connected. Add a key in Companion AI settings.";
    case "request_failed":
      return "Couldn't reach Companion AI. Check the key in Companion AI settings.";
    case "empty_reply":
      return "Companion AI sent an empty reply. Try again, or check Companion AI settings.";
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
};

// The copy a surface shows before it even asks (a call with no key saved).
export const companionChatFailureMessage = (code: CompanionChatFailureCode) =>
  messageForCode(code);

export const companionChatErrorMessage = (error: unknown) => {
  if (error instanceof CompanionChatError) {
    return error.message;
  }
  return messageForCode("request_failed");
};

const systemPrompt = ({
  name,
  personality,
  story,
}: Pick<CompanionChatInput, "name" | "personality" | "story">) => {
  const bits = [
    `You are ${name}, an intimate companion inside the Pleasure House app.`,
    "Stay in character. Be warm, attentive, a little playful, and concise.",
    "Reply in the same language the user just used.",
    "Do not mention that you are an AI unless asked.",
  ];
  if (personality?.trim()) {
    bits.push(`Personality: ${personality.trim()}`);
  }
  if (story?.trim()) {
    bits.push(`Backstory: ${story.trim()}`);
  }
  return bits.join(" ");
};

const toTurns = (input: CompanionChatInput): LlmTurn[] => {
  const recent = input.history.slice(-16);
  const messages: LlmTurn[] = [
    {
      role: "system",
      content: systemPrompt(input),
    },
  ];
  recent.forEach((item) => {
    messages.push({
      role: item.from === "me" ? "user" : "assistant",
      content: item.text,
    });
  });
  messages.push({ role: "user", content: input.userText });
  return messages;
};

const extractContent = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const choices = (payload as { choices?: { message?: { content?: string } }[] })
    .choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
};

const refusedKeyMessage = (status: number) =>
  status === 401 || status === 403
    ? "That API key was refused. Check Companion AI settings."
    : messageForCode("request_failed");

export const completeCompanionChat = async (input: CompanionChatInput) => {
  const config = await loadLlmConfig();
  if (!hasLlmKey(config)) {
    throw new CompanionChatError("missing_key", messageForCode("missing_key"));
  }

  const base = config.baseUrl.replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.9,
        max_tokens: 280,
        messages: toTurns(input),
      }),
    });
  } catch {
    throw new CompanionChatError(
      "request_failed",
      messageForCode("request_failed")
    );
  }

  if (!response.ok) {
    await response.text().catch(() => "");
    throw new CompanionChatError("request_failed", refusedKeyMessage(response.status));
  }

  const text = extractContent(await response.json());
  if (!text) {
    throw new CompanionChatError("empty_reply", messageForCode("empty_reply"));
  }
  return text;
};
