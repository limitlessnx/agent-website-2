export type PublicLeoVoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "user_speaking"
  | "endpointing"
  | "generating"
  | "tool_pending"
  | "assistant_speaking"
  | "interrupting"
  | "degraded"
  | "reconnecting"
  | "ending";

const TRANSITIONS: Record<PublicLeoVoiceState, ReadonlySet<PublicLeoVoiceState>> = {
  idle: new Set(["connecting"]),
  connecting: new Set(["listening", "degraded", "ending"]),
  listening: new Set(["user_speaking", "generating", "degraded", "ending"]),
  user_speaking: new Set(["endpointing", "degraded", "ending"]),
  endpointing: new Set(["generating", "user_speaking", "degraded", "ending"]),
  generating: new Set(["tool_pending", "assistant_speaking", "user_speaking", "interrupting", "degraded", "ending"]),
  tool_pending: new Set(["generating", "user_speaking", "interrupting", "degraded", "ending"]),
  assistant_speaking: new Set(["listening", "user_speaking", "interrupting", "degraded", "ending"]),
  interrupting: new Set(["user_speaking", "listening", "degraded", "ending"]),
  degraded: new Set(["listening", "reconnecting", "ending"]),
  reconnecting: new Set(["listening", "degraded", "ending"]),
  ending: new Set(["idle"]),
};

export type PublicLeoVoiceEpoch = {
  callEpoch: number;
  turnId: number;
  generationId: number;
};

export function canTransitionPublicLeoVoice(
  from: PublicLeoVoiceState,
  to: PublicLeoVoiceState,
) {
  return from === to || TRANSITIONS[from].has(to);
}

export function nextPublicLeoVoiceState(
  from: PublicLeoVoiceState,
  to: PublicLeoVoiceState,
) {
  if (!canTransitionPublicLeoVoice(from, to)) {
    throw new Error(`Invalid Public Leo voice transition: ${from} -> ${to}`);
  }
  return to;
}

export function isCurrentPublicLeoEpoch(
  expected: PublicLeoVoiceEpoch,
  actual: PublicLeoVoiceEpoch,
) {
  return (
    expected.callEpoch === actual.callEpoch &&
    expected.turnId === actual.turnId &&
    expected.generationId === actual.generationId
  );
}

export function createPublicLeoVoiceEpoch(callEpoch = 0): PublicLeoVoiceEpoch {
  return { callEpoch, turnId: 0, generationId: 0 };
}
