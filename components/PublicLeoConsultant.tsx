"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, Sparkles, UserRound, X } from "lucide-react";
import LeoRealtimeVoice from "@/components/leo/LeoRealtimeVoice";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type LeadDraft = {
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  need: string;
  channels: string;
  volume: string;
};

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I am Leo. I can help you understand Fluxknight services, choose a package, or scope a custom website and AI integration. What kind of business are you trying to automate?",
  },
];

const blankDraft: LeadDraft = {
  name: "",
  email: "",
  phone: "",
  company: "",
  industry: "",
  need: "",
  channels: "",
  volume: "",
};

function summarize(messages: ChatMessage[], draft: LeadDraft) {
  const transcript = messages
    .slice(-14)
    .map((message) => `${message.role === "user" ? "Visitor" : "Leo"}: ${message.content}`)
    .join("\n");
  return [
    `Website Leo conversation summary`,
    draft.need ? `Need: ${draft.need}` : "",
    draft.channels ? `Channels: ${draft.channels}` : "",
    draft.volume ? `Monthly enquiry volume: ${draft.volume}` : "",
    transcript,
  ].filter(Boolean).join("\n\n").slice(0, 3000);
}

function recommendFromDraft(draft: LeadDraft) {
  const text = `${draft.need} ${draft.channels} ${draft.volume}`.toLowerCase();
  const volume = Number(String(draft.volume).replace(/[^0-9]/g, "")) || 0;
  if (/website|web site|landing|portal|dashboard|custom|integrat|crm|multiple|branch|department/.test(text) || volume >= 5000) {
    return "Custom AI Operations";
  }
  if ((/whatsapp/.test(text) && /(call|phone|voice|email)/.test(text)) || volume >= 1000) return "AI Front Desk Suite";
  if (/(call|phone|voice)/.test(text)) return "AI Call Receptionist";
  return "WhatsApp AI Starter";
}

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
  const [draft, setDraft] = useState<LeadDraft>(blankDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const messageCount = useRef(0);

  const recommendedPlan = useMemo(() => recommendFromDraft(draft), [draft]);

  async function executeLeadCapture(nextMessages: ChatMessage[], nextDraft: LeadDraft) {
    const response = await fetch("/api/leo/tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "chat",
        toolKey: "leo.public.lead.capture",
        sessionId,
        arguments: {
          name: nextDraft.name,
          email: nextDraft.email,
          phone: nextDraft.phone,
          company_name: nextDraft.company,
          industry: nextDraft.industry,
          recommended_plan: recommendedPlan,
          notes: summarize(nextMessages, nextDraft),
          channel: "website",
          qualification: {
            business_need: nextDraft.need,
            preferred_channels: nextDraft.channels,
            monthly_enquiries: nextDraft.volume,
            recommended_plan: recommendedPlan,
          },
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || data.message || "Unable to save the conversation.");
    return data;
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isThinking) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setIsThinking(true);
    setSaveStatus("");

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

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveStatus("");
    if (!draft.name.trim() || (!draft.email.trim() && !draft.phone.trim())) {
      setSaveStatus("Add your name plus either email or WhatsApp number.");
      return;
    }
    setIsSaving(true);
    try {
      await executeLeadCapture(messages, draft);
      setSaveStatus("Saved. A Fluxknight admin can now review your summary and follow up.");
      setMessages((current) => [...current, { role: "assistant", content: "Thank you. I have saved your details and conversation summary for the Fluxknight team." }]);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Unable to save right now.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraft(key: keyof LeadDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
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
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about packages, services, or what to automate..." />
            <LeoRealtimeVoice sessionId={sessionId || undefined} />
            <button type="submit" disabled={isThinking || !input.trim()} aria-label="Send message"><Send size={17} /></button>
          </form>

          <form onSubmit={saveLead} className="public-leo-lead">
            <div className="public-leo-lead-title">
              <span><Sparkles size={14} /> Recommended: {recommendedPlan}</span>
              <small>Save your details for admin follow-up</small>
            </div>
            <div className="public-leo-fields">
              <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Name" />
              <input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="WhatsApp number" />
              <input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="Email" />
              <input value={draft.company} onChange={(event) => updateDraft("company", event.target.value)} placeholder="Business name" />
              <input value={draft.industry} onChange={(event) => updateDraft("industry", event.target.value)} placeholder="Industry" />
              <input value={draft.channels} onChange={(event) => updateDraft("channels", event.target.value)} placeholder="Channels: WhatsApp, calls, website..." />
              <input className="wide" value={draft.volume} onChange={(event) => updateDraft("volume", event.target.value)} placeholder="Monthly enquiries, if known" />
              <textarea className="wide" value={draft.need} onChange={(event) => updateDraft("need", event.target.value)} placeholder="What do you want Fluxknight to build or automate?" />
            </div>
            <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Send summary to Fluxknight"}</button>
            {saveStatus ? <p>{saveStatus}</p> : null}
          </form>
        </section>
      ) : (
        <button type="button" className="public-leo-launcher" onClick={() => setOpen(true)}>
          <span className="public-leo-pulse" aria-hidden="true" />
          <MessageCircle size={22} />
          <span className="public-leo-launcher-copy"><strong>Leo AI</strong><small>Chat or voice</small></span>
        </button>
      )}

      <style jsx>{`
        .public-leo{position:fixed;right:20px;bottom:20px;z-index:80;color:#f8fbff;font-family:inherit}
        .public-leo-launcher{position:relative;min-width:86px;min-height:86px;display:grid;place-items:center;gap:4px;padding:10px;border:1px solid rgba(167,139,250,.34);border-radius:999px;color:#fff;background:radial-gradient(circle at 35% 22%,rgba(196,181,253,.46),rgba(124,58,237,.9) 48%,rgba(24,12,52,.98));box-shadow:0 22px 70px rgba(88,28,135,.46),0 0 0 8px rgba(124,58,237,.1);cursor:pointer}
        .public-leo-launcher svg{position:relative;z-index:2}.public-leo-launcher-copy{position:relative;z-index:2;display:grid;text-align:center;line-height:1.05}.public-leo-launcher-copy strong{font-size:.74rem}.public-leo-launcher-copy small{margin-top:2px;color:#ddd6fe;font-size:.58rem;font-weight:800}.public-leo-pulse{position:absolute;inset:-7px;border:1px solid rgba(167,139,250,.28);border-radius:inherit;animation:leoLauncherPulse 2.2s ease-out infinite}
        .public-leo-panel{width:min(420px,calc(100vw - 28px));max-height:min(760px,calc(100vh - 28px));display:grid;grid-template-rows:auto minmax(160px,1fr) auto auto;border:1px solid rgba(167,139,250,.24);border-radius:18px;overflow:hidden;background:linear-gradient(145deg,rgba(12,15,30,.98),rgba(20,12,38,.98));box-shadow:0 24px 90px rgba(0,0,0,.42)}
        .public-leo-header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px;border-bottom:1px solid rgba(167,139,250,.16);background:rgba(255,255,255,.03)}
        .public-leo-header>span{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;color:#061018;background:#22d3ee}.public-leo-header strong,.public-leo-header small{display:block}.public-leo-header small{color:#a99cbd;font-size:.75rem}.public-leo-header button{width:34px;height:34px;border:1px solid rgba(167,139,250,.18);border-radius:9px;color:#f8fbff;background:rgba(255,255,255,.03);cursor:pointer}
        .public-leo-messages{display:grid;align-content:start;gap:10px;overflow:auto;padding:14px;background:radial-gradient(circle at 88% 20%,rgba(34,211,238,.08),transparent 28%)}
        .public-leo-message{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start}.public-leo-message svg{margin-top:10px;color:#67e8f9}.public-leo-message.user svg{color:#c4b5fd}.public-leo-message p{margin:0;padding:10px 12px;border:1px solid rgba(167,139,250,.14);border-radius:14px;color:#e8def8;background:rgba(255,255,255,.04);line-height:1.48;font-size:.86rem;overflow-wrap:anywhere}.public-leo-message.user p{background:rgba(34,211,238,.1);border-color:rgba(34,211,238,.2)}.thinking svg{animation:spin 1s linear infinite}
        .public-leo-input{display:grid;grid-template-columns:minmax(0,1fr) auto 42px;gap:8px;padding:12px;border-top:1px solid rgba(167,139,250,.16)}.public-leo-input input,.public-leo-fields input,.public-leo-fields textarea{min-width:0;border:1px solid rgba(167,139,250,.18);border-radius:10px;color:#f8fbff;background:#080b16;font:inherit}.public-leo-input input{height:42px;padding:0 12px}.public-leo-input button{border:0;border-radius:10px;color:#061018;background:#22d3ee;display:grid;place-items:center;cursor:pointer}.public-leo-input button:disabled{opacity:.5;cursor:not-allowed}.public-leo-input :global(.leo-realtime-voice){position:relative;display:flex}.public-leo-input :global(.leo-voice-button){width:42px;min-height:42px;padding:0;border:1px solid rgba(167,139,250,.24);border-radius:10px;color:#f8fbff;background:rgba(124,58,237,.32);box-shadow:none;font-size:0}.public-leo-input :global(.leo-voice-button.live){background:rgba(34,211,238,.22);border-color:rgba(34,211,238,.46)}.public-leo-input :global(.leo-voice-error){position:absolute;right:0;bottom:50px;width:260px;max-width:calc(100vw - 44px);padding:8px 10px;border:1px solid rgba(251,113,133,.22);border-radius:10px;color:#fecdd3;background:rgba(15,12,28,.98);font-size:.72rem;line-height:1.35}
        .public-leo-lead{display:grid;gap:10px;padding:12px;border-top:1px solid rgba(167,139,250,.16);background:rgba(255,255,255,.025)}.public-leo-lead-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.public-leo-lead-title span{display:flex;align-items:center;gap:6px;color:#a5f3fc;font-size:.75rem;font-weight:900}.public-leo-lead-title small{color:#9b91ad;font-size:.72rem;text-align:right}
        .public-leo-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.public-leo-fields input{height:36px;padding:0 10px;font-size:.82rem}.public-leo-fields textarea{min-height:62px;resize:vertical;padding:9px 10px;font-size:.82rem}.wide{grid-column:1/-1}.public-leo-lead>button{min-height:38px;border:0;border-radius:10px;color:#061018;background:linear-gradient(135deg,#22d3ee,#a78bfa);font:inherit;font-weight:900;cursor:pointer}.public-leo-lead>button:disabled{opacity:.65}.public-leo-lead>p{margin:0;color:#c4b5fd;font-size:.78rem;line-height:1.4}
        @keyframes spin{to{transform:rotate(360deg)}}@keyframes leoLauncherPulse{0%{transform:scale(.94);opacity:.75}100%{transform:scale(1.22);opacity:0}}
        @media(max-width:620px){.public-leo{right:14px;bottom:14px}.public-leo.open{left:10px;right:10px;bottom:10px}.public-leo-panel{width:100%;max-height:calc(100vh - 20px);border-radius:14px}.public-leo-fields{grid-template-columns:1fr}.public-leo-lead-title{display:grid}.public-leo-lead-title small{text-align:left}.wide{grid-column:auto}.public-leo-launcher{min-width:78px;min-height:78px}.public-leo-input{grid-template-columns:minmax(0,1fr) 42px 42px}}
      `}</style>
    </aside>
  );
}
