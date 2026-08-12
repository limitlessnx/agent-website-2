"use client";

import { FormEvent, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, UserRound, X } from "lucide-react";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
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
  const messageCount = useRef(0);

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
          pageContext: { pathname: "/", section: "public-homepage", resourceType: "public_leo_onboarding" },
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

  return (
    <aside className={`public-leo ${open ? "open" : ""}`} aria-label="Fluxknight Leo support assistant">
      {open ? (
        <section className="public-leo-panel">
          <header className="public-leo-header">
            <span><Bot size={18} /></span>
            <div>
              <strong>Leo</strong>
              <small>Fluxknight support and onboarding</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Leo"><X size={18} /></button>
          </header>

          <div className="public-leo-messages">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`public-leo-message ${message.role}`}>
                {message.role === "assistant" ? <Bot size={14} /> : <UserRound size={14} />}
                <p>{message.content}</p>
              </div>
            ))}
            {isThinking ? <div className="public-leo-message assistant thinking"><Loader2 size={14} /><p>Leo is thinking...</p></div> : null}
          </div>

          <form onSubmit={sendMessage} className="public-leo-input">
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Leo..." />
            <button type="submit" disabled={isThinking || !input.trim()} aria-label="Send message"><Send size={17} /></button>
          </form>
        </section>
      ) : (
        <button type="button" className="public-leo-launcher" onClick={() => setOpen(true)}>
          <span className="public-leo-pulse" aria-hidden="true" />
          <MessageCircle size={22} />
          <span className="public-leo-launcher-copy"><strong>Leo</strong><small>Chat</small></span>
        </button>
      )}

      <style jsx>{`
        .public-leo{position:fixed;right:20px;bottom:20px;z-index:80;color:#f8fbff;font-family:inherit}
        .public-leo-launcher{position:relative;min-width:74px;min-height:74px;display:grid;place-items:center;gap:3px;padding:9px;border:1px solid rgba(226,232,240,.28);border-radius:999px;color:#fff;background:linear-gradient(145deg,rgba(226,232,240,.18),rgba(124,58,237,.62) 42%,rgba(15,23,42,.82));box-shadow:0 18px 55px rgba(15,23,42,.38),inset 0 1px 0 rgba(255,255,255,.28);backdrop-filter:blur(18px) saturate(1.35);cursor:pointer}
        .public-leo-launcher svg{position:relative;z-index:2}.public-leo-launcher-copy{position:relative;z-index:2;display:grid;text-align:center;line-height:1.05}.public-leo-launcher-copy strong{font-size:.74rem}.public-leo-launcher-copy small{margin-top:2px;color:#ddd6fe;font-size:.58rem;font-weight:800}.public-leo-pulse{position:absolute;inset:-7px;border:1px solid rgba(167,139,250,.28);border-radius:inherit;animation:leoLauncherPulse 2.2s ease-out infinite}
        .public-leo-panel{width:min(360px,calc(100vw - 28px));max-height:min(480px,calc(100vh - 120px));display:grid;grid-template-rows:auto minmax(150px,1fr) auto;border:1px solid rgba(226,232,240,.22);border-radius:20px;overflow:hidden;background:linear-gradient(145deg,rgba(248,250,252,.14),rgba(30,41,59,.72) 42%,rgba(15,23,42,.86));box-shadow:0 24px 80px rgba(2,6,23,.44),inset 0 1px 0 rgba(255,255,255,.22);backdrop-filter:blur(24px) saturate(1.35)}
        .public-leo-header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 12px;border-bottom:1px solid rgba(226,232,240,.14);background:rgba(255,255,255,.06)}
        .public-leo-header>span{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;color:#f8fbff;background:rgba(148,163,184,.26);border:1px solid rgba(226,232,240,.2)}.public-leo-header strong,.public-leo-header small{display:block}.public-leo-header strong{font-size:.9rem}.public-leo-header small{color:#cbd5e1;font-size:.68rem}.public-leo-header button{width:32px;height:32px;border:1px solid rgba(226,232,240,.16);border-radius:10px;color:#f8fbff;background:rgba(255,255,255,.06);cursor:pointer}
        .public-leo-messages{display:grid;align-content:start;gap:9px;overflow:auto;padding:12px;background:radial-gradient(circle at 88% 18%,rgba(203,213,225,.12),transparent 32%)}
        .public-leo-message{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:start}.public-leo-message svg{margin-top:8px;color:#c4b5fd}.public-leo-message.user svg{color:#93c5fd}.public-leo-message p{margin:0;padding:9px 11px;border:1px solid rgba(226,232,240,.14);border-radius:14px;color:#f8fafc;background:rgba(15,23,42,.42);line-height:1.45;font-size:.82rem;overflow-wrap:anywhere}.public-leo-message.user p{background:rgba(148,163,184,.16);border-color:rgba(226,232,240,.18)}.thinking svg{animation:spin 1s linear infinite}
        .public-leo-input{display:grid;grid-template-columns:minmax(0,1fr) 40px;gap:8px;padding:10px;border-top:1px solid rgba(226,232,240,.14);background:rgba(15,23,42,.32)}.public-leo-input input{min-width:0;height:40px;padding:0 12px;border:1px solid rgba(226,232,240,.16);border-radius:12px;color:#f8fbff;background:rgba(2,6,23,.42);font:inherit}.public-leo-input input::placeholder{color:#aeb8c7}.public-leo-input button{border:0;border-radius:12px;color:#fff;background:linear-gradient(145deg,#8b5cf6,#6366f1);display:grid;place-items:center;cursor:pointer}.public-leo-input button:disabled{opacity:.5;cursor:not-allowed}
        @keyframes spin{to{transform:rotate(360deg)}}@keyframes leoLauncherPulse{0%{transform:scale(.94);opacity:.75}100%{transform:scale(1.22);opacity:0}}
        @media(max-width:620px){.public-leo{right:12px;bottom:12px}.public-leo.open{left:auto;right:12px;bottom:12px}.public-leo-panel{width:min(340px,calc(100vw - 24px));max-height:min(430px,calc(100vh - 120px));border-radius:18px}.public-leo-launcher{min-width:70px;min-height:70px}.public-leo-message p{font-size:.8rem}}
      `}</style>
    </aside>
  );
}
