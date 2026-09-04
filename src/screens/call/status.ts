// One turn on a hands-free call: the mic is open (listening) → the native
// recognizer hears the user finish → Ark (thinking) → the reply is spoken
// (speaking) → the mic opens again. `ready` is the connected call with the
// mic closed: before the opener, while muted, or after a failure.
export type CallPhase =
  | "connecting"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking";

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

// The mic control is a state, and a tap does the one thing that makes sense
// in that state: interrupt the companion, mute the open mic, or open it
// again. There is no press-and-hold anywhere on a call (Maxwell, TestFlight
// 1.2 (15)).
export const micButtonLabel = ({
  phase,
  muted,
}: {
  phase: CallPhase;
  muted: boolean;
}): string => {
  if (phase === "connecting") {
    return "Connecting…";
  }
  if (muted) {
    return "Muted";
  }
  switch (phase) {
    case "listening":
      return "Listening";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Tap to interrupt";
    case "ready":
      return "Tap to talk";
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};

// Shown on the call while no speech-console key is saved: the reply is
// spoken by the phone's own synthesizer, not the companion's Doubao voice,
// and this is where to fix that.
export const voiceKeyHint = (name: string): string =>
  `Using the phone's voice. Add a Voice key in Companion AI for ${name}'s real voice.`;
