"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Phone, PhoneOff, Send, UserRound, X } from "@/components/admin/ServerIcons";

type ChatMessage = { role: "assistant" | "user"; content: string };
type LeadProfile = { name: string; email: string; phone: string; organization: string; leadId?: string };
type LeadStage = "name" | "email" | "phone" | "organization" | "complete";
type RealtimeEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  item?: { type?: string; call_id?: string; name?: string; arguments?: string };
};

const firstMessage: ChatMessage = {
  role: "assistant",
  content: "Hi, I’m Leo. I can help with Fluxknight services and automation. Before we get into it, what’s your full name?",
};

function localLeoReply(input: string, count: number) {
  const lower = input.toLowerCase();
  if (/website|web site|landing|portal|dashboard|integrat|custom/.test(lower)) {
    return "Yes. Fluxknight can scope custom packages combining websites, dashboards, AI chat, WhatsApp, voice, CRM and workflow automation. Tell me what you want the system to do from enquiry through follow-up.";
  }
  if (/price|pricing|package|plan|cost/.test(lower)) {
    return "Fluxknight offers WhatsApp AI Starter, AI Call Receptionist, AI Front Desk Suite and Custom AI Operations. I can recommend the right level once I understand your channels and workflow.";
  }
  if (/whatsapp|call|voice|email|support|lead|follow/.test(lower)) {
    return "That is a strong automation use case. I’d map the customer entry point, qualification process, follow-up and the systems your team already uses before recommending the build.";
  }
  const prompts = [
    "What industry is your organization in, and what customer process are you trying to improve?",
    "Which channels should the system handle: WhatsApp, phone, website chat, email, or several of them?",
    "What outcome matters most: more leads, faster response, bookings, follow-up, support, or end-to-end automation?",
  ];
  return prompts[count % prompts.length];
}

function nextLeadQuestion(stage: LeadStage) {
  if (stage === "name") return "Thanks. What’s the best email address to reach you?";
  if (stage === "email") return "Got it. What’s the best phone number for your team to reach you?";
  if (stage === "phone") return "Thanks. And what organization or business are you looking to automate?";
  return "Thanks. I have what I need. What are you looking to automate?";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function PublicLeoConsultant() {
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState<LeadProfile | null>(null);
  const [leadDraft, setLeadDraft] = useState<Partial<LeadProfile>>({});
  const [leadStage, setLeadStage] = useState<LeadStage>("name");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callError, setCallError] = useState("");
  const [leadSaving, setLeadSaving] = useState(false);
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

  function openLeo() {
    setOpen(true);
    if (messages.length === 0) setMessages([firstMessage]);
  }

  async function saveLead(profile: LeadProfile) {
    setLeadSaving(true);
    try {
      const response = await fetch("/api/leo/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, sessionId: sessionId || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Leo could not save the enquiry.");
      setLead({ ...profile, leadId: data.leadId || undefined });
      setLeadStage("complete");
      return true;
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "I couldn’t save those details. Please try again." }]);
      return false;
    } finally {
      setLeadSaving(false);
    }
  }

  async function handleLeadConversation(content: string) {
    const value = content.trim();
    if (!value) return true;

    if (leadStage === "name") {
      setLeadDraft({ name: value });
      setLeadStage("email");
      setMessages((current) => [...current, { role: "assistant", content: nextLeadQuestion("name") }]);
      return true;
    }

    if (leadStage === "email") {
      if (!isValidEmail(value)) {
        setMessages((current) => [...current, { role: "assistant", content: "I need a valid email address so the team can reach you. What email should I use?" }]);
        return true;
      }
      setLeadDraft((current) => ({ ...current, email: value.toLowerCase() }));
      setLeadStage("phone");
      setMessages((current) => [...current, { role: "assistant", content: nextLeadQuestion("email") }]);
      return true;
    }

    if (leadStage === "phone") {
      if (value.length < 7) {
        setMessages((current) => [...current, { role: "assistant", content: "Please give me a valid phone number, including the country code if possible." }]);
        return true;
      }
      setLeadDraft((current) => ({ ...current, phone: value }));
      setLeadStage("organization");
      setMessages((current) => [...current, { role: "assistant", content: nextLeadQuestion("phone") }]);
      return true;
    }

    if (leadStage === "organization") {
      const profile: LeadProfile = {
        name: leadDraft.name || "",
        email: leadDraft.email || "",
        phone: leadDraft.phone || "",
        organization: value,
      };
      const saved = await saveLead(profile);
      if (saved) setMessages((current) => [...current, { role: "assistant", content: "Thanks. I’ve captured that. Now, tell me what you’re looking to automate." }]);
      return true;
    }

    return false;
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isThinking || isCalling || leadSaving) return;

    setMessages((current) => [...current, { role: "user", content }]);
    setInput("");

    if (leadStage !== "complete") {
      await handleLeadConversation(content);
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, content }];
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
          leadProfile: lead,
          pageContext: { pathname: window.location.pathname, section: "public-homepage", resourceType: "public_leo_onboarding", leadCaptured: true },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.reason || data.error || "Leo is temporarily unavailable.");
      if (data.sessionId) setSessionId(String(data.sessionId));
      const reply = String(data.reply || "").trim() || "Tell me a little more about what you want automated.";
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
    if (!callId || toolName !== "leo_execute_tool") return;

    let payload: { tool_key?: string; arguments?: Record<string, unknown>; confirmed?: boolean } = {};
    try { payload = JSON.parse(rawArguments); } catch { payload = {}; }

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
      sendRealtimeEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(data) } });
      sendRealtimeEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
    } catch (error) {
      const output = { ok: false, error: error instanceof Error ? error.message : "Tool execution failed." };
      try {
        sendRealtimeEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) } });
        sendRealtimeEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
      } catch {
        setCallError(output.error);
      }
    }
  }

  function handleRealtimeMessage(raw: string) {
    let event: RealtimeEvent;
    try { event = JSON.parse(raw) as RealtimeEvent; } catch { return; }
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
              instructions: "You are speaking with a new public Fluxknight visitor. Do not show or request a form. Have a natural conversation and collect these four lead details conversationally, one at a time: full name, email address, phone number, and organization/business. Start by asking for their full name. After all four are provided, use leo_execute_tool with tool_key leo.public.lead.capture and arguments containing name, email, phone, and organization. Do not ask them to click anything to provide the details. Once the lead is captured, continue the business conversation. Keep replies short and natural.",
            },
          });
        } catch {
          // The connection can close during setup.
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
            <span className="public-leo-avatar"><Bot size={18} /></span>
            <div><strong>Leo</strong><small>{isCalling ? "Live voice support" : "AI support & enquiries"}</small></div>
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
            {isCalling ? <div className="public-leo-call-status"><span className="public-leo-live-dot" /> Leo is listening. Speak naturally.</div> : null}
            {callError ? <div className="public-leo-call-error">{callError}</div> : null}
          </div>

          <div className="public-leo-actions">
            {isCalling ? (
              <button type="button" className="public-leo-call-button active" onClick={stopCall}><PhoneOff size={17} /> End call</button>
            ) : (
              <button type="button" className="public-leo-call-button" onClick={() => void startCall()}><Phone size={17} /> Talk to Leo</button>
            )}
            <form onSubmit={sendMessage} className="public-leo-input">
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={leadStage === "complete" ? "Ask Leo..." : "Reply to Leo..."} disabled={isCalling || isThinking || leadSaving} aria-label="Message Leo" />
              <button type="submit" disabled={isCalling || isThinking || leadSaving || !input.trim()} aria-label="Send message"><Send size={17} /></button>
            </form>
          </div>
        </section>
      ) : (
        <button type="button" className="public-leo-launcher" onClick={openLeo} aria-label="Open Leo">
          <span className="public-leo-pulse" aria-hidden="true" />
          <MessageCircle size={22} />
        </button>
      )}

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
