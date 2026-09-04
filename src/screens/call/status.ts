// One spoken turn on a call: hold (listening) → release → Ark (thinking) →
// the reply is spoken (speaking) → ready for the next hold.
export type CallPhase =
  | "connecting"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking";

export const NOTHING_HEARD_COPY = "Didn't catch that — hold and try again.";

export const callStatusLabel = ({
  phase,
  name,
}: {
  phase: CallPhase;
  name: string;
}): string => {
  switch (phase) {
    case "connecting":
      return `Calling ${name}`;
    case "ready":
      return "Connected";
    case "listening":
      return "Listening…";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return `${name} is speaking`;
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};

export type CallMode = "voice" | "video";

// The third control switches modes. It is named after where it goes, not
// where the call is: on a video call it reads Voice (back to audio only), on
// a voice call it reads Video — and the glyph follows the same word.
export const modeToggle = (
  video: boolean
): { target: CallMode; label: "Voice" | "Video" } =>
  video
    ? { target: "voice", label: "Voice" }
    : { target: "video", label: "Video" };

export const holdButtonLabel = (phase: CallPhase): string => {
  switch (phase) {
    case "connecting":
      return "Connecting…";
    case "listening":
      return "Release to send";
    case "speaking":
      return "Hold to interrupt";
    case "ready":
    case "thinking":
      return "Hold to talk";
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};
