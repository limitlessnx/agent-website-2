"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Check, ChevronRight, Loader2, MessageCircle, Mic, Send, ShieldCheck, X } from "@/components/admin/ServerIcons";
import LeoRealtimeVoice from "@/components/leo/LeoRealtimeVoice";
import styles from "./LeoDrawer.module.css";

type LeoAction = {
  id: string;
  toolKey: string;
  arguments: Record<string, unknown>;
  title: string;
  description: string;
  risk_level: string;
  status: string;
  approval?: "none" | "confirm" | "admin";
};
type LeoMessage = { role: "user" | "assistant"; content: string };

type LeoPageContext = {
  pathname: string;
  section: string;
  resourceType: string;
  resourceId?: string;
  localTime: string;
  timeZone: string;
};

function pageContext(pathname: string): LeoPageContext {
  const parts = pathname.split("/").filter(Boolean);
  const section = parts[1] || "dashboard";
  const resourceType = parts[2] || section;
  const resourceId = parts[3] || undefined;
  return {
    pathname,
    section,
    resourceType,
    resourceId,
    localTime: new Date().toString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function actionFromToolCall(call: {
  toolKey: string;
  arguments?: Record<string, unknown>;
  reason: string;
  approval: "none" | "confirm" | "admin";
}, index: number): LeoAction {
  const title = call.toolKey.split(".").slice(-2).map((part) => part.replace(/_/g, " ")).join(" ");
  const risk = call.approval === "admin" ? "high" : call.approval === "confirm" ? "medium" : "low";
  return {
    id: `${call.toolKey}-${index}`,
    toolKey: call.toolKey,
    arguments: call.arguments || {},
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: call.reason,
    risk_level: risk,
    status: "proposed",
    approval: call.approval,
  };
}

export default function LeoDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [messages, setMessages] = useState<LeoMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [actions, setActions] = useState<LeoAction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const context = useMemo(() => pageContext(pathname), [pathname]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") || "").trim();
    if (!message || busy) return;
    form.reset();
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    try {
      const response = await fetch("/api/leo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: conversationId || undefined, pageContext: context, channel: "chat" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Leo could not respond.");
      setConversationId(result.sessionId || "");
      setMessages((current) => [...current, { role: "assistant", content: result.reply || "Leo returned no response." }]);
      setActions((result.toolCalls || []).map((call: { toolKey: string; arguments?: Record<string, unknown>; reason: string; approval: "none" | "confirm" | "admin" }, index: number) => actionFromToolCall(call, index)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Leo could not respond.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: LeoAction, decision: "approve" | "reject") {
    if (decision === "reject") {
      setActions((current) => current.filter((item) => item.id !== action.id));
      setMessages((current) => [...current, { role: "assistant", content: `Rejected: ${action.title}. No production change was made.` }]);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/leo/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolKey: action.toolKey,
          arguments: action.arguments,
          confirmed: true,
          sessionId: conversationId || undefined,
          channel: "chat",
          pageContext: context,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Leo could not execute the approved action.");
      const success = result.ok !== false;
      setActions((current) => current.map((item) => item.id === action.id ? { ...item, status: success ? "completed" : "failed" } : item));
      setMessages((current) => [...current, {
        role: "assistant",
        content: success
          ? `${action.title} completed. ${result.result?.message || result.status || "Leo received a successful execution response."}`
          : `${action.title} failed. ${result.error || "The execution service returned a failure."}`,
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Leo could not execute the approved action.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (voiceActive) return;
    setMessages([]);
    setActions([]);
    setConversationId("");
    setError("");
    setVoice(false);
  }

  const showChatbox = open || voice;

  return (
    <>
      <button type="button" className={`${styles.floating} ${voiceActive ? styles.floatingLive : ""}`} onClick={() => setOpen((value) => !value)} aria-label={voiceActive ? "Open Leo live call" : "Open Leo"}>
        <Bot size={17} /><span>{voiceActive ? "Leo • Live" : "Leo"}</span>
      </button>

      {showChatbox ? (
        <section className={`${styles.chatbox} ${!open && voice ? styles.chatboxMinimized : ""}`} aria-label="Leo AI assistant">
          <header className={styles.header}>
            <div className={styles.identity}>
              <span className={styles.avatar}><Bot size={18} /></span>
              <span><strong>Leo</strong><small>Fluxknight operator</small></span>
            </div>
            <div className={styles.headerActions}>
              <button type="button" onClick={reset} disabled={voiceActive} aria-label="New Leo conversation"><MessageCircle size={15} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Minimize Leo"><X size={17} /></button>
            </div>
          </header>

          <div className={styles.contextBar}><span className={styles.statusDot} /><span>Context: <strong>{context.section}</strong></span><ChevronRight size={12} /><span>{context.resourceType}</span></div>

          {voice ? (
            <div className={styles.voiceArea}>
              <LeoRealtimeVoice
                sessionId={conversationId || undefined}
                pageContext={context}
                onActiveChange={(active) => { setVoiceActive(active); if (!active) setVoice(false); }}
                onSessionIdChange={setConversationId}
              />
              {open ? <button type="button" className={styles.backToChat} onClick={() => { if (!voiceActive) setVoice(false); }}>Back to chat</button> : null}
            </div>
          ) : (
            <>
              <section className={styles.body}>
                {!messages.length ? <div className={styles.welcome}><span className={styles.welcomeIcon}><Bot size={20} /></span><h2>What needs attention?</h2><p>Leo can inspect Fluxknight, explain problems, and prepare approved actions.</p></div> : null}
                {messages.map((message, index) => <article key={`${message.role}-${index}`} className={`${styles.message} ${message.role === "user" ? styles.user : ""}`}>{message.role === "assistant" ? <span className={styles.messageAvatar}><Bot size={13} /></span> : null}<div><small>{message.role === "assistant" ? "LEO" : "YOU"}</small><p>{message.content}</p></div></article>)}
                {busy ? <div className={styles.typing}><Loader2 size={14} className={styles.spin} /> Leo is inspecting Fluxknight...</div> : null}
                {actions.length ? <section className={styles.actions}><header><span><ShieldCheck size={14} /> Approval center</span></header>{actions.map((action) => <article key={action.id}><div><strong>{action.title}</strong><p>{action.description}</p><small>{action.risk_level} risk · {action.status}</small></div>{action.status === "proposed" ? <div className={styles.actionButtons}><button type="button" disabled={busy} onClick={() => decide(action, "reject")}><X size={13} /> Reject</button><button type="button" disabled={busy} onClick={() => decide(action, "approve")}><Check size={13} /> Approve</button></div> : null}</article>)}</section> : null}
                {error ? <p className={styles.error}>{error}</p> : null}
              </section>

              <form className={styles.composer} onSubmit={submit}>
                <div>
                  <textarea name="message" rows={1} placeholder="Ask Leo about this workspace..." required />
                  <button type="button" className={styles.voiceButton} onClick={() => setVoice(true)} aria-label="Start voice chat"><Mic size={16} /></button>
                  <button type="submit" disabled={busy} aria-label="Send"><Send size={16} /></button>
                </div>
                <small><ShieldCheck size={11} /> Sensitive actions remain approval-gated.</small>
              </form>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
