import { companionReply } from "../screens/love/replies";
import { hasLlmKey, loadLlmConfig } from "./llm-config";

export type LlmTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CompanionChatInput = {
  name: string;
  userText: string;
  history: { from: "me" | "them"; text: string }[];
  personality?: string;
  story?: string;
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

export const completeCompanionChat = async (input: CompanionChatInput) => {
  const config = await loadLlmConfig();
  if (!hasLlmKey(config)) {
    return companionReply(input.name, input.userText);
  }

  const base = config.baseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
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

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `LLM request failed (${response.status})`);
  }

  const text = extractContent(await response.json());
  if (!text) {
    throw new Error("Empty LLM reply");
  }
  return text;
};

export const companionChatOrFallback = async (input: CompanionChatInput) => {
  try {
    return await completeCompanionChat(input);
  } catch {
    return companionReply(input.name, input.userText);
  }
};
