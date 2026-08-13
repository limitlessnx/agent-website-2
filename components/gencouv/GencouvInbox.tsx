"use client";

import { useMemo, useState, useTransition } from "react";

type EmailMessage = {
  id?: string;
  lead_id?: string;
  recipient_email?: string;
  from_email?: string;
  subject?: string;
  status?: string;
  direction?: string;
  text_body?: string;
  html_body?: string;
  is_auto_reply?: boolean;
  read_at?: string;
  archived_at?: string;
  replied_from_dashboard_at?: string;
  created_at?: string;
  last_event_at?: string;
  message_id_header?: string;
  in_reply_to_header?: string;
  references_header?: string;
  reply_to_message_id?: string;
};

function formatTime(value?: string) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function preview(message: EmailMessage) {
  const text = message.text_body || message.html_body?.replace(/<[^>]+>/g, " ") || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 220) || "No message preview available.";
}

export default function GencouvInbox({ messages }: { messages: EmailMessage[] }) {
  const [selectedId, setSelectedId] = useState(messages.find((message) => !message.archived_at)?.id || messages[0]?.id || "");
  const [replyText, setReplyText] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [isPending, startTransition] = useTransition();

  const inboxMessages = useMemo(
    () => messages.filter((message) => message.direction === "inbound").sort((a, b) => new Date(b.last_event_at || b.created_at || 0).getTime() - new Date(a.last_event_at || a.created_at || 0).getTime()),
    [messages],
  );
  const selected = inboxMessages.find((message) => message.id === selectedId) || inboxMessages[0];
  const genuineCount = inboxMessages.filter((message) => !message.is_auto_reply).length;
  const autoReplyCount = inboxMessages.filter((message) => message.is_auto_reply).length;
  const unreadCount = inboxMessages.filter((message) => !message.read_at && !message.archived_at).length;

  const sendReply = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        setStatus("Sending reply from info@gencouv.com...");
        const response = await fetch("/api/gencouv/email-reply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            inbound_message_id: selected.id,
            to: selected.from_email || selected.recipient_email,
            subject: selected.subject,
            message: replyText,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Reply failed.");
        setReplyText("");
        setStatus("Reply sent. Refresh to see the updated thread state.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to send reply.");
      }
    });
  };

  const recordAction = (action: string) => {
    if (!selected) return;
    startTransition(async () => {
      try {
        setStatus("Recording inbox action...");
        const response = await fetch("/api/gencouv/inbox-action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message_id: selected.id, action }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Action failed.");
        setStatus("Action recorded. Refresh to see the updated dashboard state.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to record inbox action.");
      }
    });
  };

  return (
    <section id="gencouv-inbox" className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Inbox and replies</h2>
          <p>Inbound Resend replies from Gencouv campaigns. Genuine replies should move to human follow-up.</p>
        </div>
        <span className="admin-status live">{inboxMessages.length} replies</span>
      </div>

      <div className="admin-checklist" style={{ marginBottom: 14 }}>
        <span>Unread: {unreadCount}</span>
        <span>Genuine replies: {genuineCount}</span>
        <span>Auto-replies: {autoReplyCount}</span>
        <span>Outbound reply identity: info@gencouv.com</span>
      </div>

      {inboxMessages.length ? (
        <div className="gencouv-inbox-grid">
          <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
            {inboxMessages.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => setSelectedId(message.id || "")}
                style={{
                  textAlign: "left",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 12,
                  padding: 12,
                  background: selected?.id === message.id ? "var(--admin-surface-soft)" : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <strong style={{ display: "block", overflowWrap: "anywhere" }}>{message.from_email || message.recipient_email}</strong>
                <span style={{ display: "block", color: "var(--admin-text-soft)", fontSize: ".84rem", marginTop: 4 }}>{message.subject || "No subject"}</span>
                <span className={message.is_auto_reply ? "admin-status warning" : "admin-status live"} style={{ marginTop: 8 }}>
                  {message.is_auto_reply ? "auto-reply" : "genuine reply"}
                </span>
                <small style={{ display: "block", color: "var(--admin-text-muted)", marginTop: 8 }}>{formatTime(message.last_event_at || message.created_at)}</small>
              </button>
            ))}
          </div>

          <article style={{ border: "1px solid var(--admin-border)", borderRadius: 14, padding: 16, minWidth: 0 }}>
            <div className="admin-panel-header" style={{ padding: 0, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{selected?.subject || "Selected reply"}</h3>
                <p style={{ overflowWrap: "anywhere" }}>{selected?.from_email || selected?.recipient_email}</p>
              </div>
              <span className={selected?.is_auto_reply ? "admin-status warning" : "admin-status live"}>
                {selected?.is_auto_reply ? "auto" : "genuine"}
              </span>
            </div>

            <p style={{ color: "var(--admin-text-soft)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected ? preview(selected) : "No reply selected."}</p>

            <div className="admin-checklist" style={{ margin: "12px 0" }}>
              <span>Received: {formatTime(selected?.last_event_at || selected?.created_at)}</span>
              <span>Read: {selected?.read_at ? "yes" : "no"}</span>
              <span>Dashboard replied: {selected?.replied_from_dashboard_at ? "yes" : "no"}</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => recordAction(selected?.read_at ? "mark_unread" : "mark_read")} disabled={isPending}>
                {selected?.read_at ? "Mark unread" : "Mark read"}
              </button>
              <button type="button" onClick={() => recordAction("archive")} disabled={isPending}>Archive</button>
              <button type="button" onClick={() => recordAction("mark_qualified")} disabled={isPending}>Mark qualified</button>
              <button type="button" onClick={() => recordAction("move_follow_up")} disabled={isPending}>Move to follow-up</button>
              <button type="button" onClick={() => recordAction("do_not_contact")} disabled={isPending}>Do Not Contact</button>
            </div>

            {!selected?.is_auto_reply ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label className="admin-field">
                  Reply as Gencouv &lt;info@gencouv.com&gt;
                  <textarea rows={7} value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Write your reply..." />
                </label>
                <button type="button" onClick={sendReply} disabled={isPending || !replyText.trim()}>
                  {isPending ? "Sending..." : "Send reply"}
                </button>
              </div>
            ) : (
              <p style={{ color: "var(--admin-text-muted)" }}>Auto-replies are recorded separately and should not stop the lead unless manually reviewed.</p>
            )}
            <p style={{ color: "var(--admin-text-muted)", marginTop: 12 }}>{status}</p>
          </article>
        </div>
      ) : (
        <p style={{ margin: 0, color: "var(--admin-text-muted)" }}>No inbound replies recorded yet.</p>
      )}
    </section>
  );
}
