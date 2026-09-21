"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Phone, PhoneOff, Send, UserRound, X } from "@/components/admin/ServerIcons";
import { getLeoMicrophoneConstraints } from "@/lib/leo-voice-client";
import { adaptPublicLeoSilenceMs, createPublicLeoVoiceEpoch, isCurrentPublicLeoEpoch, nextPublicLeoVoiceState, PUBLIC_LEO_SILENCE_DEFAULT_MS, type PublicLeoVoiceEpoch, type PublicLeoVoiceState } from "@/lib/leo-public-voice-state";
import { publicLeoVoiceToolOutput } from "@/lib/leo-public-voice-output";

type ChatMessage = { role: "assistant" | "user"; content: string };
type LeadProfile = { name: string; email: string; phone?: string; organization?: string; leadId?: string };
type RealtimeEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  delta?: string;
  response?: { id?: string; status?: string };
  item?: { type?: string; call_id?: string; name?: string; arguments?: string };
};

const firstMessage: ChatMessage = {
  role: "assistant",
  content: "Hi, I’m Leo, Fluxknight’s support and business evaluation assistant. I’ll get a few basic details first so I can assist you properly. What’s your full name?",
};

function localLeoReply(input: string, count: number) {
  const lower = input.toLowerCase();
  if (/restaurant|food|hotel|hospitality/.test(lower)) {
    return "Fluxknight can help answer common customer questions, handle booking or simple order requests, send reminders, follow up when a customer goes quiet, and bring in a staff member when needed. What part of dealing with customers takes the most time for your team?";
  }
  if (/real estate|property|realtor/.test(lower)) {
    return "Fluxknight can respond to property enquiries, ask buyers what they are looking for, follow up if they do not reply, remind them about inspections, and hand serious buyers to your team. Where do most of your enquiries come from now?";
  }
  if (/salon|spa|barber|beauty|clinic|appointment|booking/.test(lower)) {
    return "Fluxknight can answer enquiries, help customers request appointments, send reminders, follow up automatically, and pass unusual requests to your staff. What usually causes the most missed customers for you?";
  }
  if (/price|pricing|package|plan|cost/.test(lower)) {
    return "I can help you narrow that down. Fluxknight pricing depends on what you need it to handle, so first tell me what you want customers to be able to do without waiting for your staff.";
  }
  if (/whatsapp|call|voice|email|support|lead|follow|remind|order/.test(lower)) {
    return "Fluxknight can handle that in a practical way: reply to customers, follow up when they do not respond, send reminders, collect simple requests, and hand the conversation to a person when needed. Which of those would make the biggest difference to your business?";
  }
  const prompts = [
    "What kind of business do you run, and what part of dealing with customers takes the most time?",
    "Walk me through what normally happens when a new customer contacts you. Where does it usually slow down?",
    "What would help most right now: faster replies, better follow-up, reminders, bookings, taking simple orders, or something else?"
  ];
  return prompts[count % prompts.length];
}

function asLeadProfile(value: unknown, leadId?: unknown): LeadProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const name = String(row.name || "").trim();
  const email = String(row.email || "").trim();
  const phone = String(row.phone || "").trim() || undefined;
  const organization = String(row.organization || row.business_name || "").trim() || undefined;
  if (!name || !email) return null;
  return { name, email, phone, organization, leadId: String(leadId || row.leadId || "").trim() || undefined };
}

export default function PublicLeoConsultant() {
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState<LeadProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callError, setCallError] = useState("");
  const [networkHealth, setNetworkHealth] = useState<"stable" | "unstable" | "recovering">("stable");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messageCount = useRef(0);
  const voiceStateRef = useRef<PublicLeoVoiceState>("idle");
  const voiceEpochRef = useRef<PublicLeoVoiceEpoch>(createPublicLeoVoiceEpoch());
  const toolAbortControllersRef = useRef(new Set<AbortController>());
  const processedToolCallIdsRef = useRef(new Set<string>());
  const pendingVoiceToolCountRef = useRef(0);
  const awaitingToolContinuationRef = useRef(false);
  const toolResponseDoneRef = useRef(false);
  const toolContinuationIssuedRef = useRef(false);
  const activeResponseIdRef = useRef<string | null>(null);
  const assistantAudioActiveRef = useRef(false);
  const responseHadAudioRef = useRef(false);
  const adaptiveSilenceMsRef = useRef(PUBLIC_LEO_SILENCE_DEFAULT_MS);
  const lastSpeechStoppedAtRef = useRef(0);
  const cleanEndpointTurnsRef = useRef(0);
  const connectionGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkStatsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function transitionVoice(to: PublicLeoVoiceState) {
    voiceStateRef.current = nextPublicLeoVoiceState(voiceStateRef.current, to);
  }

  function abortPendingVoiceTools() {
    for (const controller of toolAbortControllersRef.current) controller.abort();
    toolAbortControllersRef.current.clear();
  }

  function cleanupNetworkMonitoring() {
    if (connectionGraceTimerRef.current) clearTimeout(connectionGraceTimerRef.current);
    if (networkStatsTimerRef.current) clearInterval(networkStatsTimerRef.current);
    connectionGraceTimerRef.current = null;
    networkStatsTimerRef.current = null;
  }

  function enterConnectionDegraded() {
    const current = voiceStateRef.current;
    if (current !== "idle" && current !== "ending" && current !== "degraded") {
      try { transitionVoice("degraded"); } catch { voiceStateRef.current = "degraded"; }
    }
  }

  function monitorPeerConnection(peer: RTCPeerConnection) {
    cleanupNetworkMonitoring();

    const handleConnectionChange = () => {
      if (peerRef.current !== peer) return;
      const state = peer.connectionState;
      if (state === "connected") {
        if (connectionGraceTimerRef.current) clearTimeout(connectionGraceTimerRef.current);
        connectionGraceTimerRef.current = null;
        setNetworkHealth("stable");
        if (voiceStateRef.current === "degraded" || voiceStateRef.current === "reconnecting") {
          try { transitionVoice("listening"); } catch { voiceStateRef.current = "listening"; }
        }
        return;
      }
      if (state === "disconnected" || state === "failed") {
        setNetworkHealth("recovering");
        enterConnectionDegraded();
        invalidateVoiceGeneration();
        if (!connectionGraceTimerRef.current) {
          connectionGraceTimerRef.current = setTimeout(() => {
            if (peerRef.current !== peer) return;
            if (peer.connectionState === "connected") return;
            setCallError("The connection dropped. Tap Talk to Leo to reconnect.");
            stopCall();
          }, 7000);
        }
      }
    };

    peer.addEventListener("connectionstatechange", handleConnectionChange);
    peer.addEventListener("iceconnectionstatechange", handleConnectionChange);

    networkStatsTimerRef.current = setInterval(() => {
      if (peerRef.current !== peer || peer.connectionState !== "connected") return;
      void peer.getStats().then((reports) => {
        if (peerRef.current !== peer) return;
        let rtt = 0;
        let jitter = 0;
        reports.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded" && typeof report.currentRoundTripTime === "number") {
            rtt = Math.max(rtt, report.currentRoundTripTime);
          }
          if (report.type === "inbound-rtp" && report.kind === "audio" && typeof report.jitter === "number") {
            jitter = Math.max(jitter, report.jitter);
          }
        });
        setNetworkHealth(rtt > 0.6 || jitter > 0.08 ? "unstable" : "stable");
      }).catch(() => {});
    }, 3000);
  }

  function invalidateVoiceGeneration(newUserTurn = false) {
    const current = voiceEpochRef.current;
    voiceEpochRef.current = {
      callEpoch: current.callEpoch,
      turnId: current.turnId + (newUserTurn ? 1 : 0),
      generationId: current.generationId + 1,
    };
    abortPendingVoiceTools();
  }

  function resetVoiceToolContinuation() {
    pendingVoiceToolCountRef.current = 0;
    awaitingToolContinuationRef.current = false;
    toolResponseDoneRef.current = false;
    toolContinuationIssuedRef.current = false;
  }

  function maybeContinueAfterVoiceTools() {
    if (!awaitingToolContinuationRef.current) return;
    if (!toolResponseDoneRef.current) return;
    if (pendingVoiceToolCountRef.current !== 0) return;
    if (toolContinuationIssuedRef.current) return;

    toolContinuationIssuedRef.current = true;
    awaitingToolContinuationRef.current = false;
    toolResponseDoneRef.current = false;
    const current = voiceEpochRef.current;
    voiceEpochRef.current = { ...current, generationId: current.generationId + 1 };
    if (voiceStateRef.current === "tool_pending") transitionVoice("generating");
    sendRealtimeEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
  }

  function updateAdaptiveEndpoint(signal: "premature_endpoint" | "clean_turn") {
    const next = adaptPublicLeoSilenceMs(adaptiveSilenceMsRef.current, signal);
    if (next === adaptiveSilenceMsRef.current) return;
    adaptiveSilenceMsRef.current = next;
    try {
      sendRealtimeEvent({
        type: "session.update",
        session: {
          type: "realtime",
          audio: {
            input: {
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: next,
                create_response: true,
                interrupt_response: true,
              },
            },
          },
        },
      });
    } catch {}
  }

  useEffect(() => {
    return () => {
      abortPendingVoiceTools();
      cleanupNetworkMonitoring();
      dataChannelRef.current?.close();
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, []);

  function openLeo() {
    setOpen(true);
    if (messages.length === 0) setMessages([firstMessage]);
  }

  function toggleLeo() {
    if (open) {
      stopCall();
      setOpen(false);
      return;
    }
    openLeo();
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isThinking || isCalling) return;

    setMessages((current) => [...current, { role: "user", content }]);
    setInput("");


    const nextMessages = [...messages, { role: "user" as const, content }];
    setIsThinking(true);
    try {
      const response = await fetch("/api/leo/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          channel: "chat",
          sessionId: sessionId || undefined,
          history: nextMessages.slice(-12),
          visibility: "private",
          leadProfile: lead || undefined,
          pageContext: { pathname: window.location.pathname, section: "public-site", resourceType: "public_leo_evaluation", leadCaptured: Boolean(lead) },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.reason || data.error || "Leo is temporarily unavailable.");
      if (data.sessionId) setSessionId(String(data.sessionId));
      if (data.leadCaptured) {
        const captured = asLeadProfile(data.leadProfile, data.leadId);
        if (captured) setLead(captured);
      }
      const reply = String(data.reply || "").trim() || "Tell me a little more about your business and what you want to improve.";
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch {
      messageCount.current += 1;
      setMessages((current) => [...current, { role: "assistant", content: localLeoReply(content, messageCount.current) }]);
    } finally {
      setIsThinking(false);
    }
  }

  function sendRealtimeEvent(event: Record<string, unknown>) {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") throw new Error("Leo voice connection is not ready.");
    channel.send(JSON.stringify(event));
  }

  async function executeVoiceTool(event: RealtimeEvent) {
    const callId = event.call_id || event.item?.call_id;
    const toolName = event.name || event.item?.name;
    const rawArguments = event.arguments || event.item?.arguments || "{}";
    if (!callId) return;
    if (processedToolCallIdsRef.current.has(callId)) return;
    processedToolCallIdsRef.current.add(callId);

    if (toolName === "leo_end_call") {
      stopCall();
      return;
    }

    if (toolName !== "leo_execute_tool") return;

    awaitingToolContinuationRef.current = true;
    toolContinuationIssuedRef.current = false;
    pendingVoiceToolCountRef.current += 1;
    if (voiceStateRef.current === "generating") transitionVoice("tool_pending");

    let payload: { tool_key?: string; arguments?: Record<string, unknown>; confirmed?: boolean } = {};
    try { payload = JSON.parse(rawArguments); } catch { payload = {}; }

    const epoch = { ...voiceEpochRef.current };
    const controller = new AbortController();
    toolAbortControllersRef.current.add(controller);

    try {
      const response = await fetch("/api/leo/public/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          channel: "voice",
          sessionId: sessionId || undefined,
          toolKey: payload.tool_key,
          arguments: payload.arguments || {},
          confirmed: payload.confirmed === true,
          voiceTurnId: voiceEpochRef.current.turnId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted || !isCurrentPublicLeoEpoch(epoch, voiceEpochRef.current)) return;
      if (response.ok && payload.tool_key === "leo.public.lead.capture") {
        const captured = asLeadProfile(payload.arguments, data.leadId);
        if (captured) setLead(captured);
      }
      const modelOutput = publicLeoVoiceToolOutput(String(payload.tool_key || ""), data, response.ok);
      sendRealtimeEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(modelOutput) } });
    } catch (error) {
      if (controller.signal.aborted || !isCurrentPublicLeoEpoch(epoch, voiceEpochRef.current)) return;
      const output = { ok: false, error: error instanceof Error ? error.message : "Tool execution failed." };
      try {
        const modelOutput = publicLeoVoiceToolOutput(String(payload.tool_key || ""), output, false);
        sendRealtimeEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(modelOutput) } });
      } catch {
        setCallError(output.error);
      }
    } finally {
      toolAbortControllersRef.current.delete(controller);
      pendingVoiceToolCountRef.current = Math.max(0, pendingVoiceToolCountRef.current - 1);
      maybeContinueAfterVoiceTools();
    }
  }

  function handleRealtimeMessage(raw: string) {
    let event: RealtimeEvent;
    try { event = JSON.parse(raw) as RealtimeEvent; } catch { return; }
    if (event.type === "input_audio_buffer.speech_started") {
      const priorVoiceState = voiceStateRef.current;
      const sinceLastStop = lastSpeechStoppedAtRef.current ? Date.now() - lastSpeechStoppedAtRef.current : Number.POSITIVE_INFINITY;
      if (
        (priorVoiceState === "endpointing" || priorVoiceState === "generating") &&
        sinceLastStop < 1200 &&
        !assistantAudioActiveRef.current
      ) {
        cleanEndpointTurnsRef.current = 0;
        updateAdaptiveEndpoint("premature_endpoint");
      }
      if (assistantAudioActiveRef.current || voiceStateRef.current === "assistant_speaking") {
        try { sendRealtimeEvent({ type: "output_audio_buffer.clear" }); } catch {}
      }
      invalidateVoiceGeneration(true);
      assistantAudioActiveRef.current = false;
      activeResponseIdRef.current = null;
      const current = voiceStateRef.current;
      if (current === "assistant_speaking" || current === "generating" || current === "tool_pending") {
        transitionVoice("interrupting");
        transitionVoice("user_speaking");
      } else if (current === "listening" || current === "endpointing") {
        transitionVoice("user_speaking");
      }
      return;
    }
    if (event.type === "input_audio_buffer.speech_stopped") {
      lastSpeechStoppedAtRef.current = Date.now();
      if (voiceStateRef.current === "user_speaking") transitionVoice("endpointing");
      return;
    }
    if (event.type === "response.created") {
      responseHadAudioRef.current = false;
      activeResponseIdRef.current = event.response?.id || null;
      if (voiceStateRef.current === "listening" || voiceStateRef.current === "endpointing") {
        transitionVoice("generating");
      }
      return;
    }
    if (event.type === "response.output_audio.delta") {
      responseHadAudioRef.current = true;
      assistantAudioActiveRef.current = true;
      if (voiceStateRef.current === "generating") transitionVoice("assistant_speaking");
      return;
    }
    if (event.type === "response.output_audio.done") {
      assistantAudioActiveRef.current = false;
      return;
    }
    if (event.type === "response.done") {
      if (responseHadAudioRef.current && event.response?.status === "completed") {
        cleanEndpointTurnsRef.current += 1;
        if (cleanEndpointTurnsRef.current >= 3) {
          cleanEndpointTurnsRef.current = 0;
          updateAdaptiveEndpoint("clean_turn");
        }
      }
      activeResponseIdRef.current = null;
      assistantAudioActiveRef.current = false;
      responseHadAudioRef.current = false;
      if (awaitingToolContinuationRef.current) {
        toolResponseDoneRef.current = true;
        maybeContinueAfterVoiceTools();
      } else if (voiceStateRef.current === "assistant_speaking" || voiceStateRef.current === "generating") {
        transitionVoice("listening");
      }
      return;
    }
    if (event.type === "response.function_call_arguments.done" || (event.type === "response.output_item.done" && event.item?.type === "function_call")) {
      void executeVoiceTool(event);
      return;
    }
    if (event.type === "error") setCallError("Leo's voice service returned an error. Please try again.");
  }

  async function startCall() {
    if (isCalling) return;
    setCallError("");
    setOpen(true);
    if (messages.length === 0) setMessages([firstMessage]);

    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      setCallError("Voice calling is not supported by this browser.");
      return;
    }

    try {
      abortPendingVoiceTools();
      processedToolCallIdsRef.current.clear();
      resetVoiceToolContinuation();
      activeResponseIdRef.current = null;
      assistantAudioActiveRef.current = false;
      responseHadAudioRef.current = false;
      adaptiveSilenceMsRef.current = PUBLIC_LEO_SILENCE_DEFAULT_MS;
      lastSpeechStoppedAtRef.current = 0;
      cleanEndpointTurnsRef.current = 0;
      voiceEpochRef.current = createPublicLeoVoiceEpoch(voiceEpochRef.current.callEpoch + 1);
      voiceStateRef.current = "idle";
      transitionVoice("connecting");
      setIsCalling(true);
      setNetworkHealth("stable");
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      monitorPeerConnection(peer);
      const audio = new Audio();
      audio.autoplay = true;
      audio.setAttribute("aria-label", "Leo voice response");
      audioRef.current = audio;
      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) audio.srcObject = remoteStream;
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: getLeoMicrophoneConstraints() });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const dataChannel = peer.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.addEventListener("message", (event) => handleRealtimeMessage(String(event.data)));
      dataChannel.addEventListener("error", () => setCallError("Leo's voice connection encountered an error."));
      dataChannel.addEventListener("open", () => {
        try {
          transitionVoice("listening");
          transitionVoice("generating");
          sendRealtimeEvent({
            type: "response.create",
            response: {
              output_modalities: ["audio"],
              instructions: "Introduce yourself as Leo, Fluxknight's support and business evaluation assistant. Ask for the visitor's full name, then email, one question at a time. For voice email collection, never assume transcription is correct: stage the email candidate first, read the exact normalized email back to the visitor, ask whether it is correct, wait for their next spoken turn, and only mark email_confirmed=true after an explicit yes or equivalent confirmation. If they correct it, replace the candidate and confirm again. After that, guide a natural business evaluation even when the visitor does not know what they need. Diagnose where Fluxknight could improve customer response, sales support, follow-up, reminders, bookings, customer relationships or human handoff. Explain plan fit honestly: Basic is support/qualification/handoff only; Plus adds same-channel follow-up and reminders; Business adds team controls, cross-channel context and voice when configured; Business+ adds deeper customer/operations history and advanced automation. Explain the 14-day Basic trial accurately and never imply advanced reminders or voice are included. Never mention tools, function calls, lead capture, databases, workflows, background jobs, processing, saving context, APIs, or internal system status. Never ask the visitor to wait for internal work. Perform internal actions silently and continue the customer conversation naturally. Save meaningful evaluation updates and offer a human follow-up when appropriate. Do not require phone or business name. Keep replies short, clear and natural.",
            },
          });
        } catch {
          // The connection can close during setup.
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const headers: Record<string, string> = { "Content-Type": "application/sdp" };
      if (sessionId) headers["x-leo-session-id"] = sessionId;
      headers["x-leo-page-context"] = encodeURIComponent(JSON.stringify({ pathname: window.location.pathname, section: "public-site", resourceType: "public_leo_evaluation", leadCaptured: Boolean(lead) }));
      const response = await fetch("/api/leo/public/realtime", {
        method: "POST",
        headers,
        body: offer.sdp || "",
      });
      const answer = await response.text();
      if (!response.ok) throw new Error(answer || "Leo could not start the call.");
      const resolvedSessionId = response.headers.get("x-leo-session-id");
      if (resolvedSessionId) setSessionId(resolvedSessionId);
      await peer.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (error) {
      stopCall();
      setCallError(error instanceof Error ? error.message : "Leo could not start the call.");
    }
  }

  function stopCall() {
    abortPendingVoiceTools();
    cleanupNetworkMonitoring();
    processedToolCallIdsRef.current.clear();
    resetVoiceToolContinuation();
    activeResponseIdRef.current = null;
    assistantAudioActiveRef.current = false;
    responseHadAudioRef.current = false;
    adaptiveSilenceMsRef.current = PUBLIC_LEO_SILENCE_DEFAULT_MS;
    lastSpeechStoppedAtRef.current = 0;
    cleanEndpointTurnsRef.current = 0;
    voiceEpochRef.current = createPublicLeoVoiceEpoch(voiceEpochRef.current.callEpoch + 1);
    if (voiceStateRef.current !== "idle") {
      try {
        transitionVoice("ending");
      } catch {
        voiceStateRef.current = "ending";
      }
    }
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    voiceStateRef.current = "idle";
    setIsCalling(false);
  }

  return (
    <aside className={`public-leo ${open ? "open" : ""}`} aria-label="Fluxknight Leo support assistant">
      {open ? (
        <section className="public-leo-panel">
          <header className="public-leo-header">
            <span className="public-leo-avatar"><Bot size={18} /></span>
            <div><strong>Leo</strong><small>{isCalling ? "Live Fluxknight support" : "Support & business evaluation"}</small></div>
            <button type="button" className="public-leo-close" onClick={() => { stopCall(); setOpen(false); }} aria-label="Close Leo"><X size={18} /></button>
          </header>

          <div className="public-leo-messages">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`public-leo-message ${message.role}`}>
                <span>{message.role === "assistant" ? <Bot size={14} /> : <UserRound size={14} />}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {isThinking ? <div className="public-leo-message assistant thinking"><span><Bot size={14} /></span><p className="public-leo-dots"><i /><i /><i /></p></div> : null}
            {isCalling ? <div className="public-leo-call-status"><span className="public-leo-live-dot" /> {networkHealth === "stable" ? "Leo is listening. Speak naturally." : networkHealth === "recovering" ? "Connection interrupted. Trying to recover…" : "Connection is unstable."}</div> : null}
            {callError ? <div className="public-leo-call-error">{callError}</div> : null}
          </div>

          <div className="public-leo-actions">
            {isCalling ? (
              <button type="button" className="public-leo-call-button active" onClick={stopCall}><PhoneOff size={17} /> End call</button>
            ) : (
              <button type="button" className="public-leo-call-button" onClick={() => void startCall()}><Phone size={17} /> Talk to Leo</button>
            )}
            <form onSubmit={sendMessage} className="public-leo-input">
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Leo about your business..." disabled={isCalling || isThinking} aria-label="Message Leo" />
              <button type="submit" disabled={isCalling || isThinking || !input.trim()} aria-label="Send message"><Send size={17} /></button>
            </form>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="public-leo-launcher"
        onClick={toggleLeo}
        aria-label={open ? "Close Leo" : "Open Leo"}
        aria-expanded={open}
      >
        <span className="public-leo-pulse" aria-hidden="true" />
        <MessageCircle size={22} />
      </button>

      <style jsx>{`
        .public-leo{position:fixed;right:20px;bottom:20px;z-index:80;color:#f8fbff;font-family:inherit}
        .public-leo-launcher{position:relative;width:62px;height:62px;display:grid;place-items:center;padding:0;border:1px solid rgba(226,232,240,.28);border-radius:999px;color:#fff;background:linear-gradient(145deg,rgba(226,232,240,.18),rgba(124,58,237,.62) 42%,rgba(15,23,42,.82));box-shadow:0 18px 55px rgba(15,23,42,.38),inset 0 1px 0 rgba(255,255,255,.28);backdrop-filter:blur(18px) saturate(1.35);cursor:pointer}
        .public-leo-launcher svg{position:relative;z-index:2}.public-leo-pulse{position:absolute;inset:-7px;border:1px solid rgba(167,139,250,.28);border-radius:inherit;animation:leoLauncherPulse 2.2s ease-out infinite}
        .public-leo-panel{width:min(360px,calc(100vw - 28px));max-height:min(520px,calc(100vh - 120px));display:grid;grid-template-rows:auto minmax(150px,1fr) auto;border:1px solid rgba(226,232,240,.22);border-radius:20px;overflow:hidden;background:linear-gradient(145deg,rgba(248,250,252,.14),rgba(30,41,59,.72) 42%,rgba(15,23,42,.9));box-shadow:0 24px 80px rgba(2,6,23,.44),inset 0 1px 0 rgba(255,255,255,.22);backdrop-filter:blur(24px) saturate(1.35)}
        .public-leo-header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 12px;border-bottom:1px solid rgba(226,232,240,.14);background:rgba(255,255,255,.06)}
        .public-leo-avatar{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;color:#f8fbff;background:rgba(148,163,184,.26);border:1px solid rgba(226,232,240,.2)}
        .public-leo-header strong{display:block;font-size:.9rem}.public-leo-header small{display:block;margin-top:2px;color:rgba(226,232,240,.7);font-size:.72rem}
        .public-leo-close{width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(226,232,240,.16);border-radius:10px;color:#fff;background:rgba(15,23,42,.25);cursor:pointer}
        .public-leo-messages{min-height:0;overflow:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px}
        .public-leo-message{display:flex;gap:8px;align-items:flex-start;max-width:92%}.public-leo-message>span{flex:0 0 auto;width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:rgba(124,58,237,.25);border:1px solid rgba(167,139,250,.2)}
        .public-leo-message p{margin:0;padding:9px 11px;border-radius:12px;background:rgba(15,23,42,.5);border:1px solid rgba(226,232,240,.1);font-size:.83rem;line-height:1.45;color:rgba(248,250,252,.9)}
        .public-leo-message.user{margin-left:auto;flex-direction:row-reverse}.public-leo-message.user>span{background:rgba(226,232,240,.12)}.public-leo-message.user p{background:rgba(124,58,237,.38)}
        .public-leo-dots{display:flex!important;gap:4px;align-items:center;min-width:34px}.public-leo-dots i{width:5px;height:5px;border-radius:50%;background:#c4b5fd;animation:leoDot 1s ease-in-out infinite}.public-leo-dots i:nth-child(2){animation-delay:.15s}.public-leo-dots i:nth-child(3){animation-delay:.3s}
        .public-leo-actions{padding:10px;border-top:1px solid rgba(226,232,240,.12);background:rgba(2,6,23,.2)}
        .public-leo-call-button{width:100%;height:38px;display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:8px;border:1px solid rgba(167,139,250,.3);border-radius:11px;color:#fff;background:linear-gradient(135deg,rgba(124,58,237,.55),rgba(168,85,247,.42));font-weight:700;cursor:pointer}.public-leo-call-button.active{background:rgba(239,68,68,.3);border-color:rgba(248,113,113,.35)}
        .public-leo-input{display:grid;grid-template-columns:1fr 42px;gap:7px}.public-leo-input input{min-width:0;height:42px;padding:0 12px;border:1px solid rgba(226,232,240,.15);border-radius:11px;outline:none;color:#fff;background:rgba(2,6,23,.52)}.public-leo-input input::placeholder{color:rgba(226,232,240,.48)}.public-leo-input button{height:42px;display:grid;place-items:center;border:1px solid rgba(167,139,250,.25);border-radius:11px;color:#fff;background:rgba(124,58,237,.5);cursor:pointer}.public-leo-input button:disabled{opacity:.4;cursor:not-allowed}
        .public-leo-call-status,.public-leo-call-error{margin-top:3px;padding:8px 10px;border-radius:10px;font-size:.74rem;background:rgba(15,23,42,.48);color:rgba(226,232,240,.78)}.public-leo-call-error{color:#fecaca;background:rgba(127,29,29,.28)}.public-leo-live-dot{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#86efac;box-shadow:0 0 10px rgba(134,239,172,.8)}
        @keyframes leoLauncherPulse{0%{transform:scale(.92);opacity:.7}70%,100%{transform:scale(1.16);opacity:0}}@keyframes leoDot{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-3px);opacity:1}}
        @media(max-width:520px){.public-leo{right:14px;bottom:14px}.public-leo-panel{width:min(360px,calc(100vw - 28px));max-height:calc(100vh - 90px)}}
      `}</style>
    </aside>
  );
}
