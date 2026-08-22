"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Mic, MicOff, PhoneOff, Volume2 } from "@/components/admin/ServerIcons";
import styles from "./LeoRealtimeVoice.module.css";

type VoiceState = "idle" | "connecting" | "live" | "error";
type RealtimeToolEvent = { type?: string; name?: string; call_id?: string; arguments?: string; transcript?: string; item_id?: string; response_id?: string };
type PageContext = { pathname?: string; section?: string; resourceType?: string; resourceId?: string; resourceLabel?: string; timeOfDay?: string; localTime?: string; timeZone?: string };

function friendlyVoiceError(value: string) {
  const text = String(value || "");
  if (/missing_model|model parameter/i.test(text)) return "Leo voice could not start because the realtime model was rejected by OpenAI.";
  if (/invalid_request_error/i.test(text)) return "Leo voice could not start because OpenAI rejected the realtime session configuration.";
  if (/insufficient_quota|credit_balance_exhausted|429/i.test(text)) return "Leo voice is connected, but the OpenAI project needs available credits before voice can start.";
  if (/OpenAI Realtime is not configured/i.test(text)) return "Leo voice is not connected to an OpenAI key yet.";
  return text.length > 180 ? "Leo voice could not start. Please try again in a moment." : text || "Leo voice could not start.";
}

function contextInstruction(context: PageContext) {
  return [
    "CURRENT FLUXKNIGHT DASHBOARD CONTEXT:",
    JSON.stringify(context),
    "Treat this as live navigation context. If the user moves to another dashboard page, use the newest context supplied by session.update.",
  ].join("\n");
}

export default function LeoRealtimeVoice({
  sessionId,
  pageContext,
  onActiveChange,
  onSessionIdChange,
}: {
  sessionId?: string;
  pageContext?: PageContext;
  onActiveChange?: (active: boolean) => void;
  onSessionIdChange?: (sessionId: string) => void;
}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const sessionIdRef = useRef(sessionId || "");

  const currentContext = useMemo(() => ({
    ...pageContext,
    localTime: pageContext?.localTime || new Date().toISOString(),
    timeZone: pageContext?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }), [pageContext]);

  useEffect(() => {
    sessionIdRef.current = sessionId || sessionIdRef.current;
  }, [sessionId]);

  function stopMeter() {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    analyserRef.current = null;
    setVoiceLevel(0);
  }

  function startMeter(stream: MediaStream) {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        const activeAnalyser = analyserRef.current;
        if (!activeAnalyser) return;
        activeAnalyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const sample of data) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
        setVoiceLevel((previous) => previous * 0.72 + rms * 0.28);
        animationRef.current = requestAnimationFrame(tick);
      };
      void context.resume().catch(() => null);
      animationRef.current = requestAnimationFrame(tick);
    } catch {
      stopMeter();
    }
  }

  function sendEvent(event: Record<string, unknown>) {
    const channel = channelRef.current;
    if (channel?.readyState === "open") channel.send(JSON.stringify(event));
  }

  async function persistTranscript(role: "user" | "assistant", transcript: string) {
    const content = transcript.trim();
    const activeSessionId = sessionIdRef.current;
    if (!content || !activeSessionId) return;
    await fetch("/api/leo/voice/transcript", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: activeSessionId, role, content, pageContext: currentContext }),
    }).catch(() => null);
  }

  async function handleToolCall(event: RealtimeToolEvent) {
    if (event.name !== "leo_execute_tool" || !event.call_id) return;
    let args: Record<string, unknown> = {};
    try { args = event.arguments ? JSON.parse(event.arguments) as Record<string, unknown> : {}; } catch { args = {}; }
    let output: Record<string, unknown>;
    try {
      const response = await fetch("/api/leo/tool", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "voice", sessionId: sessionIdRef.current || undefined, toolKey: String(args.tool_key || ""), arguments: args.arguments && typeof args.arguments === "object" && !Array.isArray(args.arguments) ? args.arguments : {}, confirmed: args.confirmed === true, pageContext: currentContext }) });
      const result = await response.json().catch(() => ({}));
      output = response.ok ? result : { ok: false, error: result.error || "Leo tool execution failed." };
    } catch (cause) { output = { ok: false, error: cause instanceof Error ? cause.message : "Leo tool execution failed." }; }
    sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(output) } });
    sendEvent({ type: "response.create" });
  }

  async function start() {
    if (state === "connecting" || state === "live") return;
    setState("connecting"); setError(""); setMuted(false); setVoiceLevel(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const peer = new RTCPeerConnection(); peerRef.current = peer;
      for (const track of stream.getTracks()) peer.addTrack(track, stream);
      const audio = document.createElement("audio"); audio.autoplay = true; audioRef.current = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        startMeter(event.streams[0]);
        void audio.play().catch(() => null);
      };
      const dataChannel = peer.createDataChannel("oai-events"); channelRef.current = dataChannel;
      dataChannel.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as RealtimeToolEvent;
          if (event.type === "response.function_call_arguments.done") void handleToolCall(event);
          if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) void persistTranscript("user", event.transcript);
          if (event.type === "response.audio_transcript.done" && event.transcript) void persistTranscript("assistant", event.transcript);
        } catch {}
      };
      dataChannel.onopen = () => {
        setState("live");
        onActiveChange?.(true);
        sendEvent({ type: "session.update", session: { instructions: contextInstruction(currentContext) } });
        sendEvent({ type: "response.create" });
      };
      dataChannel.onerror = () => { setError("Leo voice connection encountered an error."); setState("error"); onActiveChange?.(false); };
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      const response = await fetch("/api/leo/realtime/call", { method: "POST", headers: { "content-type": "application/sdp", "x-leo-session-id": sessionIdRef.current || "", "x-leo-page-context": JSON.stringify(currentContext) }, body: offer.sdp || "" });
      const answerSdp = await response.text();
      if (!response.ok) throw new Error(friendlyVoiceError(answerSdp || "Unable to start Leo voice."));
      const serverSessionId = response.headers.get("x-leo-session-id") || "";
      if (serverSessionId) { sessionIdRef.current = serverSessionId; onSessionIdChange?.(serverSessionId); }
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (cause) {
      stop(false); setError(friendlyVoiceError(cause instanceof Error ? cause.message : "Unable to start Leo voice.")); setState("error"); onActiveChange?.(false);
    }
  }

  function stop(resetState = true) {
    channelRef.current?.close(); channelRef.current = null; peerRef.current?.close(); peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    if (audioRef.current) { audioRef.current.srcObject = null; audioRef.current.remove(); audioRef.current = null; }
    stopMeter();
    void audioContextRef.current?.close().catch(() => null);
    audioContextRef.current = null;
    setMuted(false); onActiveChange?.(false); if (resetState) { setError(""); setState("idle"); }
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  useEffect(() => {
    if (state !== "live") return;
    sendEvent({ type: "session.update", session: { instructions: contextInstruction(currentContext) } });
  }, [currentContext, state]);

  useEffect(() => () => stop(false), []);

  if (state === "error") return <div className={styles.errorCard} role="alert"><span>{error}</span><button type="button" onClick={() => void start()}>Try again</button></div>;
  if (state === "idle") return <button type="button" className={styles.launchButton} onClick={() => void start()}><span className={styles.launchIcon}><Mic size={18} /></span><span><strong>Talk to Leo</strong><small>Start voice conversation</small></span></button>;

  const live = state === "live";
  const orbScale = 1 + voiceLevel * 0.18;
  const pulseOpacity = 0.18 + voiceLevel * 0.55;
  return (
    <section className={styles.voicePanel} aria-label="Leo voice call">
      <div className={styles.topbar}><div><span className={styles.statusDot} /> {live ? "Leo is listening" : "Connecting to Leo"}</div><span className={styles.liveBadge}>{live ? "LIVE" : "CONNECTING"}</span></div>
      <div className={`${styles.orbStage} ${live ? styles.live : ""}`}>
        <div className={`${styles.ring} ${styles.ringOne}`} style={{ transform: `scale(${1 + voiceLevel * 0.06})`, opacity: 0.55 + voiceLevel * 0.45 }} />
        <div className={`${styles.ring} ${styles.ringTwo}`} style={{ transform: `scale(${1 + voiceLevel * 0.1})`, opacity: 0.55 + voiceLevel * 0.45 }} />
        <div className={`${styles.ring} ${styles.ringThree}`} style={{ transform: `scale(${1 + voiceLevel * 0.14})`, opacity: 0.55 + voiceLevel * 0.45 }} />
        <div className={styles.orb} style={{ transform: `scale(${orbScale})` }}><Volume2 size={28} /></div>
        <div className={styles.pulse} style={{ inset: `${28 - voiceLevel * 10}%`, opacity: pulseOpacity }} />
        <div className={styles.pulse} style={{ inset: `${12 - voiceLevel * 7}%`, opacity: pulseOpacity * 0.75, animationDelay: "0.5s" }} />
      </div>
      <div className={styles.identity}><h3>Leo</h3><p>{live ? (voiceLevel > 0.035 ? "Leo is speaking…" : "I'm listening. Speak naturally.") : "Establishing secure voice connection…"}</p></div>
      <div className={styles.controls}>
        <button type="button" className={`${styles.control} ${muted ? styles.activeControl : ""}`} onClick={toggleMute}>{muted ? <MicOff size={21} /> : <Mic size={21} />}<span>{muted ? "Unmute" : "Mute"}</span></button>
        <button type="button" className={styles.endCall} onClick={() => stop()}><PhoneOff size={21} /><span>End call</span></button>
      </div>
      <p className={styles.hint}>Leo can use authorized Fluxknight tools during the call.</p>
      {state === "connecting" ? <LoaderCircle size={16} className={styles.spinner} /> : null}
    </section>
  );
}
