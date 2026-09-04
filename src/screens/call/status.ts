// One turn on a hands-free call: the call connects and the companion's first
// line is fetched (greeting) → it is spoken (speaking) → the mic opens on
// its own (listening) → the native recognizer hears the user finish → Ark
// (thinking) → the reply is spoken (speaking) → the mic opens again. The mic
// is never opened by a tap. `ready` is the connected call with the loop
// stopped: muted, or halted by something only the user can fix (the mic
// permission, no Ark key). The list is the type, so a test can walk every
// phase.
export const CALL_PHASES = [
  "connecting",
  "greeting",
  "ready",
  "listening",
  "thinking",
  "speaking",
] as const;

export type CallPhase = (typeof CALL_PHASES)[number];

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
    case "greeting":
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

// Sync runs the same loop, but nobody is being called: the session is on
// and the voice joins it, so the ring reads as the voice connecting. Every
// other phase reads as on a call.
export const syncStatusLabel = ({
  phase,
  name,
}: {
  phase: CallPhase;
  name: string;
}): string =>
  phase === "connecting" ? "Connecting…" : callStatusLabel({ phase, name });

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

// The mic control is inert until the companion has said its first word: the
// call is ringing, or the opener is on its way and the mic will open by
// itself right after it (Maxwell, TestFlight 1.2 (18): a live control here
// read as an invitation to tap before talking).
export type LiveMicPhase = Exclude<CallPhase, "connecting" | "greeting">;

export const micButtonEnabled = (phase: CallPhase): phase is LiveMicPhase =>
  phase !== "connecting" && phase !== "greeting";

// The mic control is a state, and a tap does the one thing that makes sense
// in that state: interrupt the companion, mute the open mic, or resume a
// loop that stopped. Nothing here ever asks the user to tap (or hold) in
// order to talk — the mic opens on its own (Maxwell, TestFlight 1.2 (15)
// and (18)).
export const micButtonLabel = ({
  phase,
  muted,
}: {
  phase: CallPhase;
  muted: boolean;
}): string => {
  if (!micButtonEnabled(phase)) {
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
      return "Tap to resume";
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
