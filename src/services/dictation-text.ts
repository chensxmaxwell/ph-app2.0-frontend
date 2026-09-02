/** iOS dictation inserts U+FFFC as a recognition placeholder. */
export const sanitizeComposerText = (text: string) =>
  String(text || "").replace(/\uFFFC/g, "");
