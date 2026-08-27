"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, MicOff, PhoneCall, PhoneOff, X } from "@/components/admin/ServerIcons";
import styles from "./LeoRealtimeVoice.module.css";

type VoiceState = "idle" | "connecting" | "live" | "error";
type RealtimeToolEvent = { type?: string; name?: string; call_id?: string; arguments?: string; transcript?: string };
type LeoRealtimeVoiceProps = {
  sessionId?: string;
  pageContext?: Record<string, unknown>;
  mode?: "panel" | "orb";
  onCallEnded?: () => void;
  onSessionId?: (sessionId: string) => void;
  onTranscript?: (message: { role: "user" | "assistant"; content: string }) => void;
};

function friendlyVoiceError(value: string) {
  const text = String(value || "");
  if (/missing_model|model parameter/i.test(text)) return "Leo voice could not start because the realtime model was rejected by OpenAI.";
  if (/invalid_request_error/i.test(text)) return "Leo voice could not start because OpenAI rejected the realtime session configuration.";
  if (/insufficient_quota|credit_balance_exhausted|429/i.test(text)) return "Leo voice is connected, but the OpenAI project needs available credits before voice can start.";
  if (/OpenAI Realtime is not configured/i.test(text)) return "Leo voice is not connected to an OpenAI key yet.";
  return text.length > 180 ? "Leo voice could not start. Please try again in a moment." : text || "Leo voice could not start.";
}

export default function LeoRealtimeVoice({ sessionId, pageContext, mode = "panel", onCallEnded, onSessionId, onTranscript }: LeoRealtimeVoiceProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSessionIdRef = useRef(sessionId || "");
  const onCallEndedRef = useRef(onCallEnded);
  const onSessionIdRef = useRef(onSessionId);
  const onTranscriptRef = useRef(onTranscript);
  const startingRef = useRef(false);
  const manualStopRef = useRef(false);
  const transcriptKeysRef = useRef(new Set<string>());

  useEffect(() => { onCallEndedRef.current = onCallEnded; }, [onCallEnded]);
  useEffect(() => { onSessionIdRef.current = onSessionId; }, [onSessionId]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { if (sessionId) activeSessionIdRef.current = sessionId; }, [sessionId]);

  function sendEvent(event: Record<string, unknown>) {
    const channel = channelRef.current;
    if (channel?.readyState === "open") channel.send(JSON.stringify(event));
  }

  function reportLifecycle(event: "connected" | "canceled" | "ended" | "dropped" | "backgrounded" | "resumed", details: Record<string, unknown> = {}) {
    const activeSessionId = activeSessionIdRef.current;
    if (!activeSessionId) return;
    void fetch("/api/leo/realtime/lifecycle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: activeSessionId, event, details }), keepalive: true }).catch(() => null);
  }

  function cleanupConnection() {
    channelRef.current?.close(); channelRef.current = null;
    peerRef.current?.close(); peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    if (audioRef.current) { audioRef.current.srcObject = null; audioRef.current.remove(); audioRef.current = null; }
    setMuted(false);
    startingRef.current = false;
  }

  function handleUnexpectedDrop(reason: string) {
    if (manualStopRef.current) return;
    cleanupConnection();
    setError(reason);
    setState("error");
    reportLifecycle("dropped", { reason });
  }

  async function persistTranscript(role: "user" | "assistant", content: string) {
    const clean = content.trim();
    const activeSessionId = activeSessionIdRef.current;
    if (!clean || !activeSessionId) return;
    const key = `${role}:${clean.replace(/\s+/g, " ").toLowerCase()}`;
    if (transcriptKeysRef.current.has(key)) return;
    transcriptKeysRef.current.add(key);
    if (transcriptKeysRef.current.size > 80) transcriptKeysRef.current = new Set(Array.from(transcriptKeysRef.current).slice(-50));
    onTranscriptRef.current?.({ role, content: clean });
    try { await fetch("/api/leo/realtime/transcript", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: activeSessionId, role, content: clean }) }); } catch {}
  }

  async function handleToolCall(event: RealtimeToolEvent) {
    if (!event.name || !event.call_id) return;
    if (event.name === "leo_end_call") {
      sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ ok: true }) } });
      sendEvent({ type: "response.create" });
      stop("ended");
      return;
    }
    if (event.name !== "leo_execute_tool") return;
    let args: Record<string, unknown> = {};
    try { args = event.arguments ? JSON.parse(event.arguments) as Record<string, unknown> : {}; } catch { args = {}; }
    let output: Record<string, unknown>;
    try {
      const response = await fetch("/api/leo/tool", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "voice", sessionId: activeSessionIdRef.current || undefined, toolKey: String(args.tool_key || ""), arguments: args.arguments && typeof args.arguments === "object" && !Array.isArray(args.arguments) ? args.arguments : {}, confirmed: args.confirmed === true }) });
      const result = await response.json().catch(() => ({}));
      output = response.ok ? result : { ok: false, error: result.error || "Leo tool execution failed." };
    } catch (cause) {
      output = { ok: false, error: cause instanceof Error ? cause.message : "Leo tool execution failed." };
    }
    sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(output) } });
    sendEvent({ type: "response.create" });
  }

  async function start() {
    if (startingRef.current || state === "connecting" || state === "live") return;
    startingRef.current = true;
    manualStopRef.current = false;
    transcriptKeysRef.current.clear();
    setState("connecting"); setError(""); setMuted(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      for (const track of stream.getTracks()) peer.addTrack(track, stream);
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audioRef.current = audio;
      peer.ontrack = (event) => { audio.srcObject = event.streams[0]; void audio.play().catch(() => null); };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") handleUnexpectedDrop("Leo voice connection was interrupted. You can reconnect or continue by message.");
      };
      const dataChannel = peer.createDataChannel("oai-events");
      channelRef.current = dataChannel;
      dataChannel.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as RealtimeToolEvent;
          if (event.type === "response.function_call_arguments.done") void handleToolCall(event);
          else if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) void persistTranscript("user", event.transcript);
          else if (event.type === "response.output_audio_transcript.done" && event.transcript) void persistTranscript("assistant", event.transcript);
        } catch {}
      };
      dataChannel.onopen = () => { startingRef.current = false; setState("live"); reportLifecycle("connected"); };
      dataChannel.onerror = () => handleUnexpectedDrop("Leo voice connection encountered an error. You can reconnect or continue by message.");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const headers: Record<string, string> = { "content-type": "application/sdp" };
      if (activeSessionIdRef.current) headers["x-leo-session-id"] = activeSessionIdRef.current;
      if (pageContext) headers["x-leo-page-context"] = encodeURIComponent(JSON.stringify(pageContext));
      const response = await fetch("/api/leo/realtime/call", { method: "POST", headers, body: offer.sdp || "" });
      const answerSdp = await response.text();
      if (!response.ok) throw new Error(friendlyVoiceError(answerSdp || "Unable to start Leo voice."));
      const resolvedSessionId = response.headers.get("x-leo-session-id") || activeSessionIdRef.current;
      if (resolvedSessionId) { activeSessionIdRef.current = resolvedSessionId; onSessionIdRef.current?.(resolvedSessionId); }
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (cause) {
      cleanupConnection();
      setError(friendlyVoiceError(cause instanceof Error ? cause.message : "Unable to start Leo voice."));
      setState("error");
    }
  }

  function stop(reason: "canceled" | "ended" = state === "connecting" ? "canceled" : "ended", notifyParent = true) {
    manualStopRef.current = true;
    reportLifecycle(reason);
    cleanupConnection();
    setError("");
    setState("idle");
    if (notifyParent) onCallEndedRef.current?.();
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (state === "live") reportLifecycle("backgrounded");
        return;
      }
      if (state === "live") {
        reportLifecycle("resumed");
        const connectionState = peerRef.current?.connectionState;
        if (connectionState === "failed" || connectionState === "disconnected" || connectionState === "closed") handleUnexpectedDrop("Leo voice connection was interrupted while the app was in the background. Reconnect to continue the call.");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state]);

  useEffect(() => () => { manualStopRef.current = true; cleanupConnection(); }, []);

  if (mode === "orb") {
    if (state === "error") return <div className={styles.orbError} role="alert"><span>{error}</span><button type="button" onClick={() => void start()}>Try again</button></div>;
    if (state === "idle") return <button type="button" className={styles.orbLauncher} onClick={() => void start()} aria-label="Start Leo voice call"><span className={styles.orbStage}><span className={`${styles.ring} ${styles.ringOne}`} /><span className={`${styles.ring} ${styles.ringTwo}`} /><span className={`${styles.ring} ${styles.ringThree}`} /><span className={styles.orb}><PhoneCall size={30} /><span className={styles.orbShimmer} /></span><span className={`${styles.pulse} ${styles.pulseOne}`} /><span className={`${styles.pulse} ${styles.pulseTwo}`} /></span><span className={styles.orbLabel}>Call Leo</span><span className={styles.orbHint}>Tap to talk</span></button>;
  }

  if (state === "error") return <div className={styles.errorCard} role="alert"><span>{error}</span><div className={styles.errorActions}><button type="button" onClick={() => void start()}>Reconnect</button><button type="button" onClick={() => stop("ended")}>Use messages</button></div></div>;
  if (state === "idle") return <div className={styles.voiceStart}><div><strong>Voice conversation</strong><small>Talk naturally with Leo</small></div><button type="button" className={styles.startCall} onClick={() => void start()} aria-label="Start Leo voice call"><PhoneCall size={17} /><span>Call Leo</span></button></div>;

  const live = state === "live";
  return <section className={`${styles.voicePanel} ${mode === "orb" ? styles.embeddedVoicePanel : ""}`} aria-label="Leo voice call">
    <div className={styles.topbar}><div><span className={styles.statusDot} /> {live ? "Leo is listening" : "Connecting to Leo"}</div><span className={styles.liveBadge}>{live ? "LIVE" : "CONNECTING"}</span></div>
    <div className={`${styles.orbStage} ${live ? styles.live : ""}`}><div className={`${styles.ring} ${styles.ringOne}`} /><div className={`${styles.ring} ${styles.ringTwo}`} /><div className={`${styles.ring} ${styles.ringThree}`} /><div className={styles.orb}><PhoneCall size={28} /></div><div className={`${styles.pulse} ${styles.pulseOne}`} /><div className={`${styles.pulse} ${styles.pulseTwo}`} /></div>
    <div className={styles.identity}><h3>Leo</h3><p>{live ? "I'm listening. Speak naturally." : "Establishing secure voice connection…"}</p></div>
    <div className={styles.controls}><button type="button" className={`${styles.control} ${muted ? styles.activeControl : ""}`} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute microphone" : "Mute microphone"} disabled={!live}><span className={styles.controlIcon}>{muted ? <MicOff size={20} /> : <Mic size={20} />}</span><span>{muted ? "Unmute" : "Mute"}</span></button>{state === "connecting" ? <button type="button" className={styles.cancelCall} onClick={() => stop("canceled")} aria-label="Cancel Leo voice call"><X size={20} /><span>Cancel</span></button> : <button type="button" className={styles.endCall} onClick={() => stop("ended")} aria-label="End Leo voice call"><PhoneOff size={20} /><span>End call</span></button>}</div>
    <p className={styles.hint}>Leo can use authorized Fluxknight tools during the call.</p>{state === "connecting" ? <LoaderCircle size={16} className={styles.spinner} aria-label="Connecting" /> : null}
  </section>;
}
