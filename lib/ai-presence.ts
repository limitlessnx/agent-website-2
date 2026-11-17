/** Presentation only: no provider requests, tool execution or authorization decisions. */
export type AIPresenceState = "idle" | "listening" | "processing" | "speaking" | "executing" | "completed" | "error" | "disconnected";
export const aiPresenceLabels: Record<AIPresenceState, string> = {
  idle: "Ready", listening: "Listening", processing: "Processing", speaking: "Speaking",
  executing: "Executing", completed: "Completed", error: "Needs attention", disconnected: "Disconnected",
};
/** Audio generation is not evidence of playback; only output-buffer events mean speaking. */
export function voicePresenceForEvent(current: AIPresenceState, type?: string, muted = false): AIPresenceState {
  switch (type) {
    case "input_audio_buffer.speech_started": return muted ? "idle" : "listening";
    case "input_audio_buffer.speech_stopped": return muted ? "idle" : "processing";
    case "output_audio_buffer.started": return "speaking";
    case "output_audio_buffer.stopped":
    case "output_audio_buffer.cleared": return "idle";
    case "response.created": return current === "speaking" ? current : "processing";
    case "response.done": return current === "speaking" || current === "executing" ? current : "idle";
    case "error":
    case "conversation.item.input_audio_transcription.failed": return "error";
    default: return current;
  }
}
export function toolPresenceForResult(result: Record<string, unknown>, pending: boolean): AIPresenceState {
  if (pending) return "executing";
  if (result.ok === false || ["failed", "error"].includes(String(result.status))) return "error";
  // Acceptance, queued work and approval requests are never completion evidence.
  return ["completed", "succeeded"].includes(String(result.status)) ? "completed" : "idle";
}
