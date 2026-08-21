"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, Check, ChevronRight, Loader2, MessageCircle, Send, ShieldCheck, X } from "@/components/admin/ServerIcons";
import styles from "./LeoDrawer.module.css";

type LeoAction = {
  id: string;
  title: string;
  description: string;
  risk_level: string;
  status: string;
};

type LeoMessage = { role: "user" | "assistant"; content: string };

function pageContext(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const section = parts[1] || "dashboard";
  const resourceType = parts[2] || section;
  const resourceId = parts[3] || undefined;
  return { pathname, section, resourceType, resourceId };
}

export default function LeoDrawer() {
  const pathname = usePathnameSafe();
  const [open, setOpen] = useState(false);
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
      const response = await fetch("/api/admin/support/leo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: conversationId || undefined, pageContext: context }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Leo could not respond.");
      setConversationId(result.conversationId || "");
      setMessages((current) => [...current, { role: "assistant", content: result.reply || "Leo returned no response." }]);
      setActions(result.actions || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Leo could not respond.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: LeoAction, decision: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/support/leo/actions/${encodeURIComponent(action.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to update the action.");
      setActions((current) => current.map((item) => item.id === action.id ? result.action : item));
      if (result.message) setMessages((current) => [...current, { role: "assistant", content: result.message }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the action.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([]);
    setActions([]);
    setConversationId("");
    setError("");
  }

  return (
    <>
      <button type="button" className={styles.floating} onClick={() => setOpen(true)} aria-label="Open Leo support">
        <Bot size={17} />
        <span>Leo</span>
      </button>

      {open ? <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      <aside className={`${styles.drawer} ${open ? styles.open : ""}`} aria-label="Leo contextual support">
        <header className={styles.header}>
          <div className={styles.identity}>
            <span className={styles.avatar}><Bot size={18} /></span>
            <span><strong>Leo</strong><small>Fluxknight operator</small></span>
          </div>
          <div className={styles.headerActions}>
            <button type="button" onClick={reset} aria-label="New Leo conversation"><MessageCircle size={15} /></button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Leo"><X size={17} /></button>
          </div>
        </header>

        <div className={styles.contextBar}>
          <span className={styles.statusDot} />
          <span>Context: <strong>{context.section}</strong></span>
          <ChevronRight size={12} />
          <span>{context.resourceType}</span>
        </div>

        <section className={styles.body}>
          {!messages.length ? (
            <div className={styles.welcome}>
              <span className={styles.welcomeIcon}><Bot size={20} /></span>
              <h2>What needs attention?</h2>
              <p>Leo can inspect this part of Fluxknight, explain problems, and prepare approved actions.</p>
              <div className={styles.quickPrompts}>
                <button type="button" onClick={() => setMessages([{ role: "user", content: "What needs attention here?" }])}>What needs attention?</button>
                <button type="button" onClick={() => setMessages([{ role: "user", content: "Explain this page to me." }])}>Explain this page</button>
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`${styles.message} ${message.role === "user" ? styles.user : ""}`}>
              {message.role === "assistant" ? <span className={styles.messageAvatar}><Bot size={13} /></span> : null}
              <div><small>{message.role === "assistant" ? "LEO" : "YOU"}</small><p>{message.content}</p></div>
            </article>
          ))}

          {busy ? <div className={styles.typing}><Loader2 size={14} className={styles.spin} /> Leo is inspecting Fluxknight...</div> : null}

          {actions.length ? <section className={styles.actions}>
            <header><span><ShieldCheck size={14} /> Approval center</span></header>
            {actions.map((action) => <article key={action.id}>
              <div><strong>{action.title}</strong><p>{action.description}</p><small>{action.risk_level} risk · {action.status}</small></div>
              {action.status === "proposed" ? <div className={styles.actionButtons}>
                <button type="button" disabled={busy} onClick={() => decide(action, "reject")}><X size={13} /> Reject</button>
                <button type="button" disabled={busy} onClick={() => decide(action, "approve")}><Check size={13} /> Approve</button>
              </div> : null}
            </article>)}
          </section> : null}

          {error ? <p className={styles.error}>{error}</p> : null}
        </section>

        <form className={styles.composer} onSubmit={submit}>
          <div><textarea name="message" rows={1} placeholder="Ask Leo about this workspace..." /><button type="submit" disabled={busy} aria-label="Send"><Send size={16} /></button></div>
          <small><ShieldCheck size={11} /> Sensitive actions remain approval-gated.</small>
        </form>
      </aside>
    </>
  );
}

function usePathnameSafe() {
  // Keeping the pathname hook isolated makes the drawer easy to reuse in other dashboard shells.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { usePathname } = require("next/navigation") as typeof import("next/navigation");
  return usePathname();
}
