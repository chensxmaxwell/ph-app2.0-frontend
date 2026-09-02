import { ChatBubble } from "./types";

/**
 * Which row of a Message thread may carry the Regenerate control.
 *
 * Only the thread's final bubble qualifies, and only when it is a finished
 * companion reply: it comes from "them", is a text bubble with content, answers
 * an earlier user message, and no companion reply is still in flight for the
 * thread. Everything else returns null: a trailing user bubble (Ark has not
 * answered yet, or the request failed), a voice row, an empty assistant turn,
 * a greeting with no user message to regenerate from, or any thread while a
 * send / regenerate request is pending.
 */
export const regenerateTargetId = (
  messages: readonly ChatBubble[],
  replyPending: boolean
): string | null => {
  if (replyPending || messages.length === 0) {
    return null;
  }
  const last = messages[messages.length - 1];
  if (last.from !== "them" || last.voice || !last.text.trim()) {
    return null;
  }
  const answersUser = messages.slice(0, -1).some((item) => item.from === "me");
  return answersUser ? last.id : null;
};
