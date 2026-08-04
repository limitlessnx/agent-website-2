type Lead = {
  lead_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  product_interest?: string;
  broker?: string;
  lifecycle_status?: string;
  email_sequence_status?: string;
  last_contact_at?: string;
  next_follow_up_at?: string;
  message?: string;
};

type EmailMessage = {
  id?: string;
  lead_id?: string;
  recipient_email?: string;
  subject?: string;
  status?: string;
  scheduled_at?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  complained_at?: string;
  failed_at?: string;
  suppressed_at?: string;
  error_message?: string;
};

function formatTime(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status?: string) {
  if (["delivered", "opened", "clicked", "sent"].includes(status || "")) return "admin-status live";
  if (["bounced", "failed", "suppressed", "complained"].includes(status || "")) return "admin-status warning";
  return "admin-status";
}

export default function GencouvMailLeads({ leads, messages }: { leads: Lead[]; messages: EmailMessage[] }) {
  return (
    <section id="mail-leads" className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Mail leads</h2>
          <p>Only valid, email-eligible leads appear here. Open a row to view sequence and delivery history.</p>
        </div>
        <span className="admin-status live">{leads.length} eligible</span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {leads.length ? leads.map((lead) => {
          const history = messages
            .filter((message) => message.recipient_email?.toLowerCase() === lead.email?.toLowerCase() || (lead.lead_id && message.lead_id === lead.lead_id))
            .sort((a, b) => new Date(b.sent_at || b.scheduled_at || 0).getTime() - new Date(a.sent_at || a.scheduled_at || 0).getTime());
          const latest = history[0];

          return (
            <details key={lead.lead_id || lead.email} style={{ border: "1px solid var(--admin-border)", borderRadius: 14, overflow: "hidden" }}>
              <summary style={{ cursor: "pointer", listStyle: "none", padding: "14px 16px", display: "grid", gridTemplateColumns: "minmax(150px,1.2fr) minmax(180px,1.5fr) minmax(110px,.7fr) minmax(130px,.8fr)", gap: 12, alignItems: "center" }}>
                <strong>{lead.name || "Unnamed lead"}</strong>
                <span style={{ color: "var(--admin-text-soft)", overflowWrap: "anywhere" }}>{lead.email}</span>
                <span className={statusClass(latest?.status)}>{latest?.status || lead.email_sequence_status || "ready"}</span>
                <span style={{ color: "var(--admin-text-muted)", fontSize: ".82rem" }}>{formatTime(latest?.scheduled_at || lead.next_follow_up_at)}</span>
              </summary>

              <div style={{ borderTop: "1px solid var(--admin-border)", padding: 16, display: "grid", gap: 16 }}>
                <div className="admin-checklist">
                  <span>Phone: {lead.phone || "Not provided"}</span>
                  <span>Source: {lead.source || "Unknown"}</span>
                  <span>Interest: {lead.product_interest || "General"}</span>
                  <span>Broker: {lead.broker || "Not assigned"}</span>
                  <span>Lifecycle: {lead.lifecycle_status || "New"}</span>
                  <span>Last contact: {formatTime(lead.last_contact_at)}</span>
                </div>

                {lead.message ? <p style={{ margin: 0, color: "var(--admin-text-soft)", lineHeight: 1.6 }}>{lead.message}</p> : null}

                <div>
                  <h3 style={{ margin: "0 0 10px", fontSize: ".95rem" }}>Email history</h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {history.length ? history.map((message) => (
                      <div key={message.id} style={{ display: "grid", gridTemplateColumns: "minmax(160px,1.4fr) minmax(90px,.6fr) minmax(130px,.8fr)", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--admin-surface-soft)" }}>
                        <span>{message.subject || "Untitled email"}</span>
                        <span className={statusClass(message.status)}>{message.status || "queued"}</span>
                        <span style={{ color: "var(--admin-text-muted)", fontSize: ".8rem" }}>{formatTime(message.sent_at || message.scheduled_at)}</span>
                        {message.error_message ? <span style={{ gridColumn: "1 / -1", color: "var(--admin-danger, #fca5a5)", fontSize: ".82rem" }}>{message.error_message}</span> : null}
                      </div>
                    )) : <p style={{ margin: 0, color: "var(--admin-text-muted)" }}>No Resend history recorded yet.</p>}
                  </div>
                </div>
              </div>
            </details>
          );
        }) : <p style={{ margin: 0 }}>No valid email leads yet.</p>}
      </div>
    </section>
  );
}
