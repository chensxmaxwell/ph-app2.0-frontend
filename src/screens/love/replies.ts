const FALLBACKS = [
  "I'm right here. Keep talking to me.",
  "I like the way you say that. What else?",
  "I'm with you. Tell me what you want next.",
  "Mm. Stay a little longer.",
];

const hash = (value: string) => {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(total);
};

export const companionReply = (name: string, userText: string) => {
  const text = userText.trim();
  const lower = text.toLowerCase();

  if (/^(hi|hey|hello|yo)\b/.test(lower)) {
    return `Hey — it's ${name}. I'm here with you.`;
  }
  if (/\b(how are you|how's it going|whats up|what's up)\b/.test(lower)) {
    return "Better now that you're talking to me. How are you feeling?";
  }
  if (/\b(love|miss you|want you)\b/.test(lower)) {
    return "I feel that. Stay with me a little longer.";
  }
  if (/\?/.test(text)) {
    return "That's a good question. Tell me what you hope the answer is.";
  }
  if (text.length < 8) {
    return "I'm listening. Say a little more.";
  }

  const snippet = text.length > 42 ? `${text.slice(0, 42)}…` : text;
  const extras = [
    `I heard you — “${snippet}”. I'm right here.`,
    ...FALLBACKS,
  ];
  return extras[hash(text) % extras.length];
};

export const nextRegeneratedReply = (current: string) => {
  const options = [
    "Let me try that again. I'm still with you.",
    "Different take: I want to hear more of that.",
    ...FALLBACKS,
  ];
  return options.find((line) => line !== current) ?? options[0];
};
