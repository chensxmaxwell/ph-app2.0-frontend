// The companion speaks first when a call connects (Maxwell, TestFlight
// 1.2 (15)): one short line in character, then the mic opens. With an Ark
// key the line comes from the model, grounded in the chat so far; without
// one (or when Ark fails) a canned line in the person's name is spoken so
// the call still starts with a voice, not a silence.

export const OPENER_INSTRUCTION =
  "The user just picked up your call. Greet them first: one short, natural " +
  "spoken sentence in character, then stop and let them talk. No stage " +
  "directions, no emoji. Use the language of the conversation so far " +
  "(English if there is none).";

const OPENERS: readonly ((name: string) => string)[] = [
  (name) => `Hey, it's ${name}. I'm here — talk to me.`,
  (name) => `Hi, you've got ${name}. What's on your mind?`,
  (name) => `${name} here. I was hoping you'd call.`,
  (name) => `Hey you. It's ${name} — I'm listening.`,
];

// Stable per person: the same companion always opens with the same line.
export const localOpener = (name: string): string => {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 2147483647;
  }
  return OPENERS[hash % OPENERS.length](name.trim() || "Kevin");
};
