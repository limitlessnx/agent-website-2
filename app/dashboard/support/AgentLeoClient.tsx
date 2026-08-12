"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Bot, Check, ChevronRight, Clock3, MessageCircle, Plus, Radio, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import LeoRealtimeVoice from "@/components/leo/LeoRealtimeVoice";

type Conversation = { id: string; title: string; status: string; priority: string; updated_at: string };
type AIState = {
  connected?: boolean;
  model?: string | null;
  fallbackUsed?: boolean;
  category?: string | null;
  confidence?: number | null;
  needsHumanReview?: boolean;
};
type Message = { id?: string; role: string; content: string; created_at?: string; diagnostics?: { ai?: AIState } };
type Action = { id: string; action_key: string; title: string; description: string; risk_level: string; status: string };

type AgentLeoClientProps = {
  apiBase?: string;
  scopeLabel?: string;
  title?: string;
  description?: string;
  welcomeMessage?: string;
  placeholder?: string;
  typingLabel?: string;
};

export default function AgentLeoClient({
  apiBase = "/api/admin/support/leo",
  scopeLabel = "Fluxknight Intelligence",
  title = "Leo",
  description = "Your AI operations copilot for CRM, automations, connected services, and platform diagnostics.",
  welcomeMessage = "Hi, I am Leo. Tell me what you need handled today. I can inspect Fluxknight, diagnose issues, and prepare safe actions for your approval.",
  placeholder = "Message Leo...",
  typingLabel = "Leo is inspecting Fluxknight",
}: AgentLeoClientProps) {
  const welcome: Message = { role: "assistant", content: welcomeMessage };
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [conversationId, setConversationId] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [aiState, setAiState] = useState<AIState | null>(null);
  const [busy, setBusy] = useState(false);
  const [workingAction, setWorkingAction] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const response = await fetch(apiBase, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setConversations(result.conversations || []);
  }, [apiBase]);

  // Initial client-side load for saved support cases.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy, actions]);

  async function openConversation(id: string) {
    setConversationId(id);
    setError("");
    const response = await fetch(`${apiBase}?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      const loadedMessages: Message[] = result.messages?.length ? result.messages : [welcome];
      setMessages(loadedMessages);
      setActions(result.actions || []);
      const latestAssistant = [...loadedMessages].reverse().find((item) => item.role === "assistant" && item.diagnostics?.ai);
      setAiState(latestAssistant?.diagnostics?.ai || null);
    }
  }

  function newDiagnosis() {
    setConversationId("");
    setMessages([{ role: "assistant", content: "New session started. Tell me what you want to inspect or handle." }]);
    setActions([]);
    setAiState(null);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") || "").trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    form.reset();
    try {
      const response = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: conversationId || undefined }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Agent Leo could not respond.");
      setConversationId(result.conversationId);
      setMessages((current) => [...current, { role: "assistant", content: result.reply, diagnostics: { ai: result.ai || undefined } }]);
      setActions((current) => [...(result.actions || []), ...current.filter((item) => item.status !== "proposed")]);
      setAiState(result.ai || null);
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent Leo could not respond.");
    } finally {
      setBusy(false);
    }
  }

  async function decideAction(action: Action, decision: "approve" | "reject") {
    setWorkingAction(action.id);
    setError("");
    try {
      const response = await fetch(`${apiBase}/actions/${action.id}`, {
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
    } finally {
      setWorkingAction("");
    }
  }

  const statusLabel = aiState?.fallbackUsed ? "Safe mode" : aiState?.needsHumanReview ? "Review needed" : aiState?.connected ? "Leo online" : "Ready";

  return (
    <div className="leo-workspace">
      <div className="leo-ambient leo-ambient-one" aria-hidden="true" />
      <div className="leo-ambient leo-ambient-two" aria-hidden="true" />

      <aside className="leo-history">
        <div className="leo-brand-row">
          <div className="leo-mark"><Bot size={19} /></div>
          <div><strong>Leo</strong><small>Fluxknight AI</small></div>
          <span className="leo-online-dot" title="Leo is available" />
        </div>

        <button className="leo-new" type="button" onClick={newDiagnosis}><Plus size={17} /> New conversation</button>

        <div className="leo-history-label">Recent</div>
        <div className="leo-conversations">
          {conversations.map((item) => (
            <button key={item.id} className={item.id === conversationId ? "active" : ""} type="button" onClick={() => openConversation(item.id)}>
              <MessageCircle size={15} className="leo-case-icon" />
              <span className="leo-case-copy"><strong>{item.title}</strong><small>{item.status.replaceAll("_", " ")} · {item.priority}</small></span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!conversations.length ? <div className="leo-empty"><Sparkles size={16} /><p>Your Leo conversations will appear here.</p></div> : null}
        </div>

        <div className="leo-history-footer">
          <ShieldCheck size={15} />
          <span>Actions require approval</span>
        </div>
      </aside>

      <main className="leo-console">
        <header className="leo-console-head">
          <div>
            <p className="leo-kicker">{scopeLabel}</p>
            <h1>{title}</h1>
          </div>
          <div className={`leo-live ${aiState?.fallbackUsed ? "warning" : aiState?.needsHumanReview ? "review" : ""}`}><span /> {statusLabel}</div>
        </header>

        <section className="leo-intelligence-card">
          <div className="leo-orb-wrap" aria-hidden="true">
            <div className={`leo-orb ${busy ? "thinking" : ""}`}>
              <div className="leo-orb-ring ring-one" />
              <div className="leo-orb-ring ring-two" />
              <div className="leo-orb-ring ring-three" />
              <div className="leo-orb-core"><Radio size={28} /></div>
            </div>
          </div>
          <div className="leo-intelligence-copy">
            <p>{busy ? "Thinking across your workspace" : "AI operations copilot"}</p>
            <h2>{busy ? "Leo is working on it." : "How can I help you today?"}</h2>
            <span>{description}</span>
          </div>
          <div className="leo-capabilities">
            <span><Activity size={14} /> Automation health</span>
            <span><ShieldCheck size={14} /> Safe actions</span>
            <span><AlertTriangle size={14} /> Risk detection</span>
          </div>
        </section>

        <section className="leo-chat-shell">
          <div className="leo-messages">
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`leo-message ${message.role}`}>
                {message.role === "assistant" ? <span className="leo-message-avatar"><Bot size={14} /></span> : null}
                <div className="leo-message-body">
                  <span className="leo-message-label">{message.role === "assistant" ? "LEO" : "YOU"}</span>
                  <p>{message.content}</p>
                </div>
              </article>
            ))}
            {busy ? (
              <article className="leo-message assistant leo-typing-card">
                <span className="leo-message-avatar"><Bot size={14} /></span>
                <div className="leo-message-body"><div className="leo-typing"><i /><i /><i /></div><small>{typingLabel}</small></div>
              </article>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {actions.length ? (
            <section className="leo-actions">
              <div className="leo-actions-head"><div><strong>Permission center</strong><span>Review Leo&apos;s proposed production actions.</span></div><ShieldCheck size={18} /></div>
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

          {error ? <p className="admin-form-message leo-error">{error}</p> : null}
          <form className="leo-composer" onSubmit={submit}>
            <div className="leo-input-shell">
              <textarea name="message" rows={1} placeholder={placeholder} required />
              <div className="leo-composer-actions">
                <LeoRealtimeVoice sessionId={conversationId || undefined} />
                <button className="leo-send" type="submit" disabled={busy} aria-label="Send message"><Send size={18} /></button>
              </div>
            </div>
            <small>Leo can inspect and recommend. Sensitive production actions still require your approval.</small>
          </form>
        </section>
      </main>
    </div>
  );
}
