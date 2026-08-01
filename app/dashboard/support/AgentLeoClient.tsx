"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, Send, ShieldCheck, Activity, AlertTriangle } from "lucide-react";

type Conversation = { id: string; title: string; status: string; priority: string; updated_at: string };
type Message = { id?: string; role: string; content: string; created_at?: string };
type Action = { action_key: string; title: string; description: string; risk_level: string };

export default function AgentLeoClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "I’m Agent Leo, Fluxknight’s AI Operations Support Engineer. Tell me what failed, which organization is affected, and what you expected to happen. I’ll inspect the platform before suggesting a fix." },
  ]);
  const [conversationId, setConversationId] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void loadConversations(); }, []);

  async function loadConversations() {
    const response = await fetch("/api/admin/support/leo", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setConversations(result.conversations || []);
  }

  async function openConversation(id: string) {
    setConversationId(id);
    setActions([]);
    const response = await fetch(`/api/admin/support/leo?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setMessages(result.messages || []);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") || "").trim();
    if (!message || busy) return;
    setBusy(true); setError(""); setActions([]);
    setMessages((current) => [...current, { role: "user", content: message }]);
    form.reset();
    try {
      const response = await fetch("/api/admin/support/leo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: conversationId || undefined }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Agent Leo could not respond.");
      setConversationId(result.conversationId);
      setMessages((current) => [...current, { role: "assistant", content: result.reply }]);
      setActions(result.actions || []);
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent Leo could not respond.");
    } finally { setBusy(false); }
  }

  return (
    <div className="leo-layout">
      <aside className="leo-history admin-panel">
        <div className="leo-history-head"><span><Bot size={18} /></span><div><strong>Agent Leo</strong><small>AI Operations Support</small></div></div>
        <button className="admin-button" type="button" onClick={() => { setConversationId(""); setMessages([{ role: "assistant", content: "New diagnostic session started. Describe the incident and I’ll inspect the platform." }]); setActions([]); }}>New diagnosis</button>
        <div className="leo-conversations">
          {conversations.map((item) => <button key={item.id} className={item.id === conversationId ? "active" : ""} type="button" onClick={() => openConversation(item.id)}><strong>{item.title}</strong><span>{item.status} · {item.priority}</span></button>)}
          {!conversations.length ? <p>No saved support conversations yet.</p> : null}
        </div>
      </aside>

      <section className="leo-console admin-panel">
        <div className="leo-console-head">
          <div><p className="admin-kicker">Super Admin Support</p><h1>Agent Leo</h1><p>Diagnose agents, workflows, integrations, organization provisioning, and delivery failures from one support console.</p></div>
          <div className="leo-live"><span /> Live diagnostics</div>
        </div>

        <div className="leo-capabilities">
          <span><Activity size={15} /> Reads workflow health</span>
          <span><ShieldCheck size={15} /> Approval-gated actions</span>
          <span><AlertTriangle size={15} /> Detects operational risks</span>
        </div>

        <div className="leo-messages">
          {messages.map((message, index) => <article key={`${message.role}-${index}`} className={`leo-message ${message.role}`}><span>{message.role === "assistant" ? "LEO" : "YOU"}</span><p>{message.content}</p></article>)}
          {busy ? <article className="leo-message assistant"><span>LEO</span><p>Running diagnostics across Fluxknight, Supabase, and n8n...</p></article> : null}
        </div>

        {actions.length ? <div className="leo-actions"><strong>Proposed actions</strong>{actions.map((action) => <article key={action.action_key}><div><h3>{action.title}</h3><p>{action.description}</p></div><span>{action.risk_level} risk · approval required</span></article>)}</div> : null}
        {error ? <p className="admin-form-message">{error}</p> : null}

        <form className="leo-composer" onSubmit={submit}>
          <textarea name="message" rows={3} placeholder="Example: Maia stopped delivering WhatsApp messages for Limitless Realty. Diagnose the cause." required />
          <button type="submit" disabled={busy}><Send size={17} /> {busy ? "Diagnosing..." : "Send to Leo"}</button>
        </form>
      </section>
    </div>
  );
}
