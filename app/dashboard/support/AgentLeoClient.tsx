"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Bot, Check, ChevronRight, Clock3, Send, ShieldCheck, Sparkles, X } from "lucide-react";

type Conversation = { id: string; title: string; status: string; priority: string; updated_at: string };
type Message = { id?: string; role: string; content: string; created_at?: string };
type Action = { id: string; action_key: string; title: string; description: string; risk_level: string; status: string };

const welcome: Message = {
  role: "assistant",
  content: "I’m Agent Leo, Fluxknight’s AI Operations Support Engineer. Tell me what failed, which organization is affected, and what you expected to happen. I’ll inspect the platform before suggesting a fix.",
};

export default function AgentLeoClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [conversationId, setConversationId] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [busy, setBusy] = useState(false);
  const [workingAction, setWorkingAction] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void loadConversations(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy, actions]);

  async function loadConversations() {
    const response = await fetch("/api/admin/support/leo", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setConversations(result.conversations || []);
  }

  async function openConversation(id: string) {
    setConversationId(id);
    setError("");
    const response = await fetch(`/api/admin/support/leo?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessages(result.messages?.length ? result.messages : [welcome]);
      setActions(result.actions || []);
    }
  }

  function newDiagnosis() {
    setConversationId("");
    setMessages([{ role: "assistant", content: "New diagnostic session started. Describe the incident and I’ll inspect the platform." }]);
    setActions([]);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") || "").trim();
    if (!message || busy) return;
    setBusy(true); setError("");
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
      setActions((current) => [...(result.actions || []), ...current.filter((item) => item.status !== "proposed")]);
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent Leo could not respond.");
    } finally { setBusy(false); }
  }

  async function decideAction(action: Action, decision: "approve" | "reject") {
    setWorkingAction(action.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/support/leo/actions/${action.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to update permission.");
      setActions((current) => current.map((item) => item.id === action.id ? result.action : item));
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update permission.");
    } finally { setWorkingAction(""); }
  }

  return (
    <div className="leo-workspace">
      <aside className="leo-history admin-panel">
        <div className="leo-history-head">
          <span className="leo-avatar"><Bot size={20} /></span>
          <div><strong>Agent Leo</strong><small>AI Operations Support</small></div>
        </div>
        <button className="leo-new" type="button" onClick={newDiagnosis}><Sparkles size={16} /> New diagnosis</button>
        <div className="leo-history-label">Recent cases</div>
        <div className="leo-conversations">
          {conversations.map((item) => (
            <button key={item.id} className={item.id === conversationId ? "active" : ""} type="button" onClick={() => openConversation(item.id)}>
              <span className="leo-case-copy"><strong>{item.title}</strong><small>{item.status.replaceAll("_", " ")} · {item.priority}</small></span>
              <ChevronRight size={15} />
            </button>
          ))}
          {!conversations.length ? <p className="leo-empty">No saved support conversations yet.</p> : null}
        </div>
      </aside>

      <section className="leo-console admin-panel">
        <header className="leo-console-head">
          <div className="leo-title-row">
            <span className="leo-avatar large"><Bot size={24} /></span>
            <div><p className="admin-kicker">Super Admin Support</p><h1>Agent Leo</h1><p>Diagnose agents, workflows, integrations, provisioning, and delivery failures from one support console.</p></div>
          </div>
          <div className="leo-live"><span /> Live diagnostics</div>
        </header>

        <div className="leo-capabilities">
          <span><Activity size={15} /> Workflow health</span>
          <span><ShieldCheck size={15} /> Approval controls</span>
          <span><AlertTriangle size={15} /> Risk detection</span>
        </div>

        <div className="leo-chat-shell">
          <div className="leo-messages">
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`leo-message ${message.role}`}>
                <span className="leo-message-label">{message.role === "assistant" ? "LEO" : "YOU"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {busy ? (
              <article className="leo-message assistant leo-typing-card">
                <span className="leo-message-label">LEO</span>
                <div className="leo-typing"><i /><i /><i /></div>
                <small>Inspecting Fluxknight, Supabase, and n8n</small>
              </article>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {actions.length ? (
            <section className="leo-actions">
              <div className="leo-actions-head"><div><strong>Permission center</strong><span>Leo cannot change production without your approval.</span></div><ShieldCheck size={18} /></div>
              {actions.map((action) => (
                <article key={action.id || action.action_key} className={`leo-action ${action.status}`}>
                  <div className="leo-action-copy"><span className={`leo-risk ${action.risk_level}`}>{action.risk_level} risk</span><h3>{action.title}</h3><p>{action.description}</p></div>
                  {action.status === "proposed" ? (
                    <div className="leo-action-buttons">
                      <button type="button" className="reject" disabled={workingAction === action.id} onClick={() => decideAction(action, "reject")}><X size={15} /> Reject</button>
                      <button type="button" className="approve" disabled={workingAction === action.id} onClick={() => decideAction(action, "approve")}><Check size={15} /> {workingAction === action.id ? "Saving..." : "Approve"}</button>
                    </div>
                  ) : <div className="leo-action-status"><Clock3 size={14} /> {action.status}</div>}
                </article>
              ))}
            </section>
          ) : null}

          {error ? <p className="admin-form-message">{error}</p> : null}
          <form className="leo-composer" onSubmit={submit}>
            <textarea name="message" rows={3} placeholder="Ask Leo about a failed agent, workflow, message, organization, or integration..." required />
            <button type="submit" disabled={busy}><Send size={17} /> {busy ? "Leo is thinking" : "Send"}</button>
          </form>
        </div>
      </section>
    </div>
  );
}
