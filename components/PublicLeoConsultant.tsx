"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Phone, PhoneOff, Send, UserRound, X } from "@/components/admin/ServerIcons";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type RealtimeEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  item?: { type?: string; call_id?: string; name?: string; arguments?: string };
};

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I am Leo. I can help you understand Fluxknight services, choose a package, or scope a custom website and AI integration. What kind of business are you trying to automate?",
  },
];

function localLeoReply(input: string, count: number) {
  const lower = input.toLowerCase();
  if (/website|web site|landing|portal|dashboard|integrat|custom/.test(lower)) {
    return "Yes. Fluxknight can scope custom packages that combine website building, dashboards, AI chat, WhatsApp, voice, CRM, and automation integrations. To recommend the right path, tell me your business type, the customer channels you need, and the main process you want automated.";
  }
  if (/price|pricing|package|plan|cost/.test(lower)) {
    return "The starter packages are WhatsApp AI Starter, AI Call Receptionist, AI Front Desk Suite, and Custom AI Operations. The best fit depends on your channels, enquiry volume, and whether you need website or system integrations. Which channels matter most for your business?";
  }
  if (/whatsapp|call|voice|email|support|lead|follow/.test(lower)) {
    return "That sounds like a good automation use case. I would ask three things before choosing a package: what channel should answer customers first, how many enquiries you get monthly, and what should happen after a lead is qualified.";
  }
  const prompts = [
    "What industry is your business in, and what do customers usually ask you for?",
    "Which channels should the agent handle: WhatsApp, phone, website chat, email, or all of them?",
    "What outcome matters most: faster replies, lead qualification, bookings, follow-up, support, or a custom workflow?",
  ];
  return prompts[count % prompts.length];
}

export default function PublicLeoConsultant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callError, setCallError] = useState("");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messageCount = useRef(0);

  useEffect(() => {
    return () => {
      dataChannelRef.current?.close();
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isThinking) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setIsThinking(true);

    try {
      const response = await fetch("/api/leo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          channel: "chat",
          sessionId: sessionId || undefined,
          history: nextMessages.slice(-12),
          visibility: "private",
          pageContext: { pathname: window.location.pathname, section: "public-homepage", resourceType: "public_leo_onboarding" },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.reason || data.error || "Leo is temporarily unavailable.");
      if (data.sessionId) setSessionId(String(data.sessionId));
      const reply = String(data.reply || "").trim() || "I understand. Tell me a little more about what you want automated.";
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch {
      messageCount.current += 1;
      setMessages([...nextMessages, { role: "assistant", content: localLeoReply(content, messageCount.current) }]);
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
    if (!callId || toolName !== "leo_execute_tool") return;

    let payload: { tool_key?: string; arguments?: Record<string, unknown>; confirmed?: boolean } = {};
    try {
      payload = JSON.parse(rawArguments);
    } catch {
      payload = {};
    }

    try {
      const response = await fetch("/api/leo/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "voice",
          sessionId: sessionId || undefined,
          toolKey: payload.tool_key,
          arguments: payload.arguments || {},
          confirmed: payload.confirmed === true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      sendRealtimeEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: JSON.stringify(data) },
      });
      sendRealtimeEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
    } catch (error) {
      const output = { ok: false, error: error instanceof Error ? error.message : "Tool execution failed." };
      try {
        sendRealtimeEvent({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
        });
        sendRealtimeEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
      } catch {
        setCallError(output.error);
      }
    }
  }

  function handleRealtimeMessage(raw: string) {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(raw) as RealtimeEvent;
    } catch {
      return;
    }

    if (event.type === "response.function_call_arguments.done" || (event.type === "response.output_item.done" && event.item?.type === "function_call")) {
      void executeVoiceTool(event);
      return;
    }

    if (event.type === "error") {
      setCallError("Leo's voice service returned an error. Please try again.");
    }
  }

  async function startCall() {
    if (isCalling) return;
    setCallError("");
    setOpen(true);

    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      setCallError("Voice calling is not supported by this browser.");
      return;
    }

    try {
      setIsCalling(true);
      const peer = new RTCPeerConnection();
      peerRef.current = peer;

      const audio = new Audio();
      audio.autoplay = true;
      audio.setAttribute("aria-label", "Leo voice response");
      audioRef.current = audio;

      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) audio.srcObject = remoteStream;
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const dataChannel = peer.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.addEventListener("message", (event) => handleRealtimeMessage(String(event.data)));
      dataChannel.addEventListener("error", () => setCallError("Leo's voice connection encountered an error."));
      dataChannel.addEventListener("open", () => {
        try {
          sendRealtimeEvent({
            type: "response.create",
            response: {
              output_modalities: ["audio"],
              instructions: "Greet the caller briefly as Leo and ask how you can help with their Fluxknight enquiry.",
            },
          });
        } catch {
          // The connection can close between the event and the open callback.
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const response = await fetch("/api/leo/realtime/call", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp || "",
      });
      const answer = await response.text();
      if (!response.ok) throw new Error(answer || "Leo could not start the call.");

      await peer.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (error) {
      stopCall();
      setCallError(error instanceof Error ? error.message : "Leo could not start the call.");
    }
  }

  function stopCall() {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setIsCalling(false);
  }

  return (
    <aside className={`public-leo ${open ? "open" : ""}`} aria-label="Fluxknight Leo support assistant">
      {open ? (
        <section className="public-leo-panel">
          <header className="public-leo-header">
            <span><Bot size={18} /></span>
            <div>
              <strong>Leo</strong>
              <small>{isCalling ? "Live voice support" : "AI support & enquiries"}</small>
            </div>
            <button type="button" onClick={() => { stopCall(); setOpen(false); }} aria-label="Close Leo"><X size={18} /></button>
          </header>

          <div className="public-leo-messages">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`public-leo-message ${message.role}`}>
                {message.role === "assistant" ? <Bot size={14} /> : <UserRound size={14} />}
                <p>{message.content}</p>
              </div>
            ))}
            {isThinking ? (
              <div className="public-leo-message assistant thinking">
                <Bot size={14} />
                <p className="public-leo-dots" aria-label="Leo is typing"><i /><i /><i /></p>
              </div>
            ) : null}
            {isCalling ? <div className="public-leo-call-status"><span className="public-leo-live-dot" /> Leo is listening. Speak naturally.</div> : null}
            {callError ? <div className="public-leo-call-error">{callError}</div> : null}
          </div>

          <div className="public-leo-actions">
            {isCalling ? (
              <button type="button" className="public-leo-call-button active" onClick={stopCall} aria-label="End voice call">
                <PhoneOff size={17} /> End call
              </button>
            ) : (
              <button type="button" className="public-leo-call-button" onClick={() => void startCall()} aria-label="Talk to Leo by voice">
                <Phone size={17} /> Talk to Leo
              </button>
            )}
            <form onSubmit={sendMessage} className="public-leo-input">
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Leo..." disabled={isCalling} />
              <button type="submit" disabled={isThinking || isCalling || !input.trim()} aria-label="Send message"><Send size={17} /></button>
            </form>
          </div>
        </section>
      ) : (
        <div className="public-leo-launcher-group">
          <button type="button" className="public-leo-call-launcher" onClick={() => void startCall()} aria-label="Call Leo">
            <Phone size={19} />
          </button>
          <button type="button" className="public-leo-launcher" onClick={() => setOpen(true)} aria-label="Open Leo">
            <span className="public-leo-pulse" aria-hidden="true" />
            <MessageCircle size={22} />
          </button>
        </div>
      )}

      <style jsx>{`
        .public-leo{position:fixed;right:20px;bottom:20px;z-index:80;color:#f8fbff;font-family:inherit}
        .public-leo-launcher-group{display:flex;align-items:center;gap:10px}
        .public-leo-launcher,.public-leo-call-launcher{position:relative;width:62px;height:62px;display:grid;place-items:center;padding:0;border:1px solid rgba(226,232,240,.28);border-radius:999px;color:#fff;background:linear-gradient(145deg,rgba(226,232,240,.18),rgba(124,58,237,.62) 42%,rgba(15,23,42,.82));box-shadow:0 18px 55px rgba(15,23,42,.38),inset 0 1px 0 rgba(255,255,255,.28);backdrop-filter:blur(18px) saturate(1.35);cursor:pointer}
        .public-leo-call-launcher{width:46px;height:46px;background:rgba(15,23,42,.84);border-color:rgba(167,139,250,.35);box-shadow:0 12px 34px rgba(15,23,42,.3)}
        .public-leo-launcher svg{position:relative;z-index:2}.public-leo-pulse{position:absolute;inset:-7px;border:1px solid rgba(167,139,250,.28);border-radius:inherit;animation:leoLauncherPulse 2.2s ease-out infinite}
        .public-leo-panel{width:min(360px,calc(100vw - 28px));max-height:min(520px,calc(100vh - 120px));display:grid;grid-template-rows:auto minmax(150px,1fr) auto;border:1px solid rgba(226,232,240,.22);border-radius:20px;overflow:hidden;background:linear-gradient(145deg,rgba(248,250,252,.14),rgba(30,41,59,.72) 42%,rgba(15,23,42,.86));box-shadow:0 24px 80px rgba(2,6,23,.44),inset 0 1px 0 rgba(255,255,255,.22);backdrop-filter:blur(24px) saturate(1.35)}
        .public-leo-header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 12px;border-bottom:1px solid rgba(226,232,240,.14);background:rgba(255,255,255,.06)}
        .public-leo-header>span{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;color:#f8fbff;background:rgba(148,163,184,.26);border:1px solid rgba(226,232,240,.2)}.public-leo-header strong{display:block;font-size:.9rem}.public-leo-header small{display:block;margin-top:2px;color:#b8c2d0;font-size:.68rem}.public-leo-header button{width:32px;height:32px;border:1px solid rgba(226,232,240,.16);border-radius:10px;color:#f8fbff;background:rgba(255,255,255,.06);cursor:pointer}
        .public-leo-messages{display:grid;align-content:start;gap:9px;overflow:auto;padding:12px;background:radial-gradient(circle at 88% 18%,rgba(203,213,225,.12),transparent 32%)}
        .public-leo-message{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:start}.public-leo-message svg{margin-top:8px;color:#c4b5fd}.public-leo-message.user svg{color:#93c5fd}.public-leo-message p{margin:0;padding:9px 11px;border:1px solid rgba(226,232,240,.14);border-radius:14px;color:#f8fafc;background:rgba(15,23,42,.42);line-height:1.45;font-size:.82rem;overflow-wrap:anywhere}.public-leo-message.user p{background:rgba(148,163,184,.16);border-color:rgba(226,232,240,.18)}
        .public-leo-dots{display:flex;align-items:center;gap:5px;width:max-content;min-width:46px;min-height:34px}.public-leo-dots i{width:6px;height:6px;border-radius:999px;background:#d8b4fe;animation:leoTypingDots 1.05s ease-in-out infinite}.public-leo-dots i:nth-child(2){animation-delay:.15s}.public-leo-dots i:nth-child(3){animation-delay:.3s}
        .public-leo-call-status{display:flex;align-items:center;gap:7px;padding:9px 11px;border:1px solid rgba(167,139,250,.2);border-radius:12px;color:#ddd6fe;background:rgba(124,58,237,.12);font-size:.75rem}.public-leo-live-dot{width:7px;height:7px;border-radius:999px;background:#a78bfa;box-shadow:0 0 0 4px rgba(167,139,250,.12);animation:leoLivePulse 1.5s infinite}.public-leo-call-error{padding:9px 11px;border:1px solid rgba(248,113,113,.25);border-radius:12px;color:#fecaca;background:rgba(127,29,29,.18);font-size:.73rem;line-height:1.4}
        .public-leo-actions{padding:10px;border-top:1px solid rgba(226,232,240,.14);background:rgba(15,23,42,.32)}.public-leo-call-button{width:100%;height:40px;margin-bottom:8px;border:1px solid rgba(167,139,250,.3);border-radius:12px;color:#fff;background:linear-gradient(145deg,#7c3aed,#6366f1);display:flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer}.public-leo-call-button.active{background:linear-gradient(145deg,#991b1b,#7f1d1d);border-color:rgba(248,113,113,.3)}
        .public-leo-input{display:grid;grid-template-columns:minmax(0,1fr) 40px;gap:8px}.public-leo-input input{min-width:0;height:40px;padding:0 12px;border:1px solid rgba(226,232,240,.16);border-radius:12px;color:#f8fbff;background:rgba(2,6,23,.42);font:inherit}.public-leo-input input::placeholder{color:#aeb8c7}.public-leo-input button{border:0;border-radius:12px;color:#fff;background:linear-gradient(145deg,#8b5cf6,#6366f1);display:grid;place-items:center;cursor:pointer}.public-leo-input button:disabled{opacity:.5;cursor:not-allowed}
        @keyframes leoLauncherPulse{0%{transform:scale(.94);opacity:.75}100%{transform:scale(1.22);opacity:0}}@keyframes leoTypingDots{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}@keyframes leoLivePulse{0%,100%{opacity:.55;transform:scale(.92)}50%{opacity:1;transform:scale(1.12)}}
        @media(max-width:620px){.public-leo{right:12px;bottom:12px}.public-leo.open{left:auto;right:12px;bottom:12px}.public-leo-panel{width:min(340px,calc(100vw - 24px));max-height:min(470px,calc(100vh - 120px));border-radius:18px}.public-leo-launcher{width:58px;height:58px}.public-leo-message p{font-size:.8rem}}
      `}</style>
    </aside>
  );
}
