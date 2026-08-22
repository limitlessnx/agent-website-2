"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Phone, PhoneOff, Send, UserRound, X } from "@/components/admin/ServerIcons";

type ChatMessage = { role: "assistant" | "user"; content: string };
type LeadProfile = { name: string; email: string; phone: string; organization: string; leadId?: string };
type RealtimeEvent = { type?: string; name?: string; call_id?: string; arguments?: string; item?: { type?: string; call_id?: string; name?: string; arguments?: string } };

const initialMessages: ChatMessage[] = [{
  role: "assistant",
  content: "Thanks. I have your details. I’m Leo, Fluxknight’s AI business consultant. Tell me what you’re looking to automate and I’ll help you map the right solution.",
}];

function localLeoReply(input: string, count: number) {
  const lower = input.toLowerCase();
  if (/website|web site|landing|portal|dashboard|integrat|custom/.test(lower)) return "Yes. Fluxknight can scope custom packages combining websites, dashboards, AI chat, WhatsApp, voice, CRM and workflow automation. Tell me what you want the system to do from enquiry through follow-up.";
  if (/price|pricing|package|plan|cost/.test(lower)) return "Fluxknight offers WhatsApp AI Starter, AI Call Receptionist, AI Front Desk Suite and Custom AI Operations. I can recommend the right level once I understand your channels and workflow.";
  if (/whatsapp|call|voice|email|support|lead|follow/.test(lower)) return "That is a strong automation use case. I’d map the customer entry point, qualification process, follow-up and the systems your team already uses before recommending the build.";
  const prompts = [
    "What industry is your organization in, and what customer process are you trying to improve?",
    "Which channels should the system handle: WhatsApp, phone, website chat, email, or several of them?",
    "What outcome matters most: more leads, faster response, bookings, follow-up, support, or end-to-end automation?",
  ];
  return prompts[count % prompts.length];
}

export default function PublicLeoConsultant() {
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState<LeadProfile | null>(null);
  const [leadForm, setLeadForm] = useState({ name: "", email: "", phone: "", organization: "" });
  const [leadError, setLeadError] = useState("");
  const [capturingLead, setCapturingLead] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  useEffect(() => () => {
    dataChannelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  async function captureLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (capturingLead) return;
    setLeadError("");
    const payload = {
      name: leadForm.name.trim(),
      email: leadForm.email.trim().toLowerCase(),
      phone: leadForm.phone.trim(),
      organization: leadForm.organization.trim(),
      sessionId: sessionId || undefined,
    };
    if (!payload.name || !payload.email || !payload.phone || !payload.organization) {
      setLeadError("Please complete all four fields before continuing.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setLeadError("Please enter a valid email address.");
      return;
    }

    try {
      setCapturingLead(true);
      const response = await fetch("/api/leo/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Leo could not save your details.");
      const profile = { ...payload, leadId: data.leadId || undefined };
      setLead(profile);
      setMessages(initialMessages);
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : "Leo could not save your details.");
    } finally {
      setCapturingLead(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isThinking || !lead) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
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
          leadProfile: lead,
          pageContext: { pathname: window.location.pathname, section: "public-homepage", resourceType: "public_leo_onboarding", leadCaptured: true },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.reason || data.error || "Leo is temporarily unavailable.");
      if (data.sessionId) setSessionId(String(data.sessionId));
      const reply = String(data.reply || "").trim() || "Tell me a little more about what you want automated.";
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
    try { payload = JSON.parse(rawArguments); } catch { payload = {}; }
    try {
      const response = await fetch("/api/leo/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "voice", sessionId: sessionId || undefined, toolKey: payload.tool_key, arguments: payload.arguments || {}, confirmed: payload.confirmed === true }),
      });
      const data = await response.json().catch(() => ({}));
      sendRealtimeEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(data) } });
      sendRealtimeEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
    } catch (error) {
      const output = { ok: false, error: error instanceof Error ? error.message : "Tool execution failed." };
      try {
        sendRealtimeEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) } });
        sendRealtimeEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
      } catch { setCallError(output.error); }
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
    if (isCalling || !lead) return;
    setCallError("");
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
      peer.ontrack = (event) => { const [remoteStream] = event.streams; if (remoteStream) audio.srcObject = remoteStream; };
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
              instructions: `Greet ${lead.name} briefly as Leo. Their organization is ${lead.organization}. Ask what they want Fluxknight to automate. Do not ask for their contact details again.`,
            },
          });
        } catch { /* connection can close during setup */ }
      });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/leo/realtime/call", { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer.sdp || "" });
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
            <div><strong>Leo</strong><small>{isCalling ? "Live voice support" : "AI support & enquiries"}</small></div>
            <button type="button" onClick={() => { stopCall(); setOpen(false); }} aria-label="Close Leo"><X size={18} /></button>
          </header>

          {!lead ? (
            <form className="public-leo-lead-form" onSubmit={captureLead}>
              <div className="public-leo-lead-icon"><Bot size={22} /></div>
              <h3>Before we get started</h3>
              <p>Leo needs a few details so your enquiry can be captured and our team can follow up properly.</p>
              <label><span>Full name</span><input value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} placeholder="Your full name" autoComplete="name" /></label>
              <label><span>Email address</span><input type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} placeholder="you@company.com" autoComplete="email" /></label>
              <label><span>Phone number</span><input type="tel" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="+234..." autoComplete="tel" /></label>
              <label><span>Organization / business</span><input value={leadForm.organization} onChange={(e) => setLeadForm({ ...leadForm, organization: e.target.value })} placeholder="Organization you want to automate" autoComplete="organization" /></label>
              {leadError ? <div className="public-leo-lead-error">{leadError}</div> : null}
              <button type="submit" className="public-leo-lead-submit" disabled={capturingLead}>{capturingLead ? "Saving details..." : "Continue to Leo"}<Send size={16} /></button>
              <small className="public-leo-privacy">Your details are used to handle this enquiry and follow up about Fluxknight services.</small>
            </form>
          ) : (
            <>
              <div className="public-leo-messages">
                {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`public-leo-message ${message.role}`}><span>{message.role === "assistant" ? <Bot size={14} /> : <UserRound size={14} />}</span><p>{message.content}</p></div>)}
                {isThinking ? <div className="public-leo-message assistant"><span><Bot size={14} /></span><p className="public-leo-dots"><i /><i /><i /></p></div> : null}
                {isCalling ? <div className="public-leo-call-status"><span className="public-leo-live-dot" /> Leo is listening. Speak naturally.</div> : null}
                {callError ? <div className="public-leo-call-error">{callError}</div> : null}
              </div>
              <div className="public-leo-actions">
                {isCalling ? <button type="button" className="public-leo-call-button active" onClick={stopCall}><PhoneOff size={17} /> End call</button> : <button type="button" className="public-leo-call-button" onClick={() => void startCall()}><Phone size={17} /> Talk to Leo</button>}
                <form onSubmit={sendMessage} className="public-leo-input"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Leo..." disabled={isCalling || isThinking} /><button type="submit" disabled={isThinking || isCalling || !input.trim()} aria-label="Send message"><Send size={17} /></button></form>
              </div>
            </>
          )}
        </section>
      ) : (
        <button type="button" className="public-leo-launcher" onClick={() => setOpen(true)} aria-label="Open Leo"><span className="public-leo-pulse" aria-hidden="true" /><MessageCircle size={22} /></button>
      )}

      <style jsx>{`
        .public-leo{position:fixed;right:20px;bottom:20px;z-index:80;color:#f8fbff;font-family:inherit}
        .public-leo-launcher{position:relative;width:62px;height:62px;display:grid;place-items:center;padding:0;border:1px solid rgba(226,232,240,.28);border-radius:999px;color:#fff;background:linear-gradient(145deg,rgba(226,232,240,.18),rgba(124,58,237,.62) 42%,rgba(15,23,42,.82));box-shadow:0 18px 55px rgba(15,23,42,.38),inset 0 1px 0 rgba(255,255,255,.28);backdrop-filter:blur(18px) saturate(1.35);cursor:pointer}
        .public-leo-pulse{position:absolute;inset:-7px;border:1px solid rgba(167,139,250,.28);border-radius:inherit;animation:leoLauncherPulse 2.2s ease-out infinite}
        .public-leo-panel{width:min(360px,calc(100vw - 28px));max-height:min(560px,calc(100vh - 100px));display:grid;grid-template-rows:auto minmax(0,1fr);border:1px solid rgba(226,232,240,.22);border-radius:20px;overflow:hidden;background:linear-gradient(145deg,rgba(248,250,252,.14),rgba(30,41,59,.72) 42%,rgba(15,23,42,.86));box-shadow:0 24px 80px rgba(2,6,23,.44),inset 0 1px 0 rgba(255,255,255,.22);backdrop-filter:blur(24px) saturate(1.35)}
        .public-leo-header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 12px;border-bottom:1px solid rgba(226,232,240,.14);background:rgba(255,255,255,.06)}
        .public-leo-header>span{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;color:#f8fbff;background:rgba(148,163,184,.26);border:1px solid rgba(226,232,240,.2)}.public-leo-header strong{display:block;font-size:.9rem}.public-leo-header small{display:block;margin-top:2px;color:#b8c2d0;font-size:.68rem}.public-leo-header button{width:32px;height:32px;border:1px solid rgba(226,232,240,.16);border-radius:10px;color:#f8fbff;background:rgba(255,255,255,.06);cursor:pointer}
        .public-leo-lead-form{overflow:auto;padding:18px 15px 14px;display:grid;align-content:start;gap:11px}.public-leo-lead-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;color:#ddd6fe;background:rgba(124,58,237,.16);border:1px solid rgba(167,139,250,.22)}.public-leo-lead-form h3{margin:0;font-size:1.05rem}.public-leo-lead-form>p{margin:-5px 0 2px;color:#b9c1cf;font-size:.76rem;line-height:1.45}.public-leo-lead-form label{display:grid;gap:5px}.public-leo-lead-form label span{font-size:.68rem;color:#cbd5e1}.public-leo-lead-form input{height:41px;width:100%;box-sizing:border-box;padding:0 11px;border:1px solid rgba(226,232,240,.15);border-radius:11px;color:#fff;background:rgba(2,6,23,.4);font:inherit;font-size:.78rem;outline:none}.public-leo-lead-form input:focus{border-color:rgba(167,139,250,.6);box-shadow:0 0 0 3px rgba(124,58,237,.12)}.public-leo-lead-form input::placeholder{color:#8994a6}.public-leo-lead-submit{height:42px;border:1px solid rgba(167,139,250,.3);border-radius:12px;color:#fff;background:linear-gradient(145deg,#7c3aed,#6366f1);display:flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:.79rem;font-weight:700;cursor:pointer}.public-leo-lead-submit:disabled{opacity:.6;cursor:not-allowed}.public-leo-lead-error{padding:8px 10px;border:1px solid rgba(248,113,113,.25);border-radius:10px;color:#fecaca;background:rgba(127,29,29,.18);font-size:.7rem}.public-leo-privacy{color:#7f8b9c;font-size:.62rem;line-height:1.4}
        .public-leo-messages{min-height:0;display:grid;align-content:start;gap:9px;overflow:auto;padding:12px;background:radial-gradient(circle at 88% 18%,rgba(203,213,225,.12),transparent 32%)}.public-leo-message{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:start}.public-leo-message>span{margin-top:8px;color:#c4b5fd}.public-leo-message.user>span{color:#93c5fd}.public-leo-message p{margin:0;padding:9px 11px;border:1px solid rgba(226,232,240,.14);border-radius:14px;color:#f8fafc;background:rgba(15,23,42,.42);line-height:1.45;font-size:.82rem;overflow-wrap:anywhere}.public-leo-message.user p{background:rgba(148,163,184,.16);border-color:rgba(226,232,240,.18)}
        .public-leo-dots{display:flex;align-items:center;gap:5px;width:max-content;min-width:46px;min-height:34px}.public-leo-dots i{width:6px;height:6px;border-radius:999px;background:#d8b4fe;animation:leoTypingDots 1.05s ease-in-out infinite}.public-leo-dots i:nth-child(2){animation-delay:.15s}.public-leo-dots i:nth-child(3){animation-delay:.3s}.public-leo-call-status{display:flex;align-items:center;gap:7px;padding:9px 11px;border:1px solid rgba(167,139,250,.2);border-radius:12px;color:#ddd6fe;background:rgba(124,58,237,.12);font-size:.75rem}.public-leo-live-dot{width:7px;height:7px;border-radius:999px;background:#a78bfa;box-shadow:0 0 0 4px rgba(167,139,250,.12);animation:leoLivePulse 1.5s infinite}.public-leo-call-error{padding:9px 11px;border:1px solid rgba(248,113,113,.25);border-radius:12px;color:#fecaca;background:rgba(127,29,29,.18);font-size:.73rem;line-height:1.4}
        .public-leo-actions{padding:10px;border-top:1px solid rgba(226,232,240,.14);background:rgba(15,23,42,.32)}.public-leo-call-button{width:100%;height:40px;margin-bottom:8px;border:1px solid rgba(167,139,250,.3);border-radius:12px;color:#fff;background:linear-gradient(145deg,#7c3aed,#6366f1);display:flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer}.public-leo-call-button.active{background:linear-gradient(145deg,#991b1b,#7f1d1d);border-color:rgba(248,113,113,.3)}
        .public-leo-input{display:grid;grid-template-columns:minmax(0,1fr) 40px;gap:8px}.public-leo-input input{min-width:0;height:40px;padding:0 12px;border:1px solid rgba(226,232,240,.16);border-radius:12px;color:#f8fbff;background:rgba(2,6,23,.42);font:inherit}.public-leo-input input::placeholder{color:#aeb8c7}.public-leo-input button{border:0;border-radius:12px;color:#fff;background:linear-gradient(145deg,#8b5cf6,#6366f1);display:grid;place-items:center;cursor:pointer}.public-leo-input button:disabled{opacity:.5;cursor:not-allowed}
        @keyframes leoLauncherPulse{0%{transform:scale(.94);opacity:.75}100%{transform:scale(1.22);opacity:0}}@keyframes leoTypingDots{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}@keyframes leoLivePulse{0%,100%{opacity:.55;transform:scale(.92)}50%{opacity:1;transform:scale(1.12)}}
        @media(max-width:620px){.public-leo{right:12px;bottom:12px}.public-leo-panel{width:min(340px,calc(100vw - 24px));max-height:min(590px,calc(100vh - 90px));border-radius:18px}.public-leo-launcher{width:58px;height:58px}.public-leo-message p{font-size:.8rem}}
      `}</style>
    </aside>
  );
}
