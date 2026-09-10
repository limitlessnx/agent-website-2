import { Bot, LineChart, Users } from "@/components/admin/ServerIcons";
import MetricCard from "@/components/admin/MetricCard";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { recordGencouvTelegramConversationAction } from "../actions";
import "./gencouv-premium.css";

type WebEvent = {
  event_name?: "page_view" | "telegram_cta_click" | "email_campaign_landing";
  session_id?: string;
  cohort?: string;
  created_at?: string;
};

type TelegramConversation = {
  id?: number;
  conversation_started_at?: string;
  source_cohort?: string;
  source_campaign?: string;
  note?: string;
};

export const dynamic = "force-dynamic";

export default async function GencouvLayout({ children }: { children: React.ReactNode }) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [events, conversations] = await Promise.all([
    supabaseServerRequest<WebEvent[]>(
      `gencouv_web_events?select=event_name,session_id,cohort,created_at&event_name=eq.telegram_cta_click&created_at=gte.${encodeURIComponent(thirtyDaysAgo)}&order=created_at.desc&limit=10000`,
    ).catch(() => []),
    supabaseServerRequest<TelegramConversation[]>(
      `gencouv_telegram_conversations?select=id,conversation_started_at,source_cohort,source_campaign,note&conversation_started_at=gte.${encodeURIComponent(thirtyDaysAgo)}&order=conversation_started_at.desc&limit=1000`,
    ).catch(() => []),
  ]);

  const handoffSessions = new Set(events.map((event) => event.session_id).filter(Boolean));
  const handoffs = handoffSessions.size;
  const genuineConversations = conversations.length;
  const handoffToConversationRate = handoffs ? ((genuineConversations / handoffs) * 100).toFixed(1) : "0.0";
  const gap = Math.max(handoffs - genuineConversations, 0);

  const emailRows = Array.from({ length: 7 }, (_, index) => {
    const cohort = `email_${index + 1}`;
    const cohortHandoffs = new Set(
      events.filter((event) => event.cohort === cohort).map((event) => event.session_id).filter(Boolean),
    ).size;
    const cohortConversations = conversations.filter((conversation) => conversation.source_cohort === cohort).length;
    const rate = cohortHandoffs ? ((cohortConversations / cohortHandoffs) * 100).toFixed(1) : "0.0";
    return { emailNumber: index + 1, handoffs: cohortHandoffs, conversations: cohortConversations, rate };
  });

  const maxHandoffs = Math.max(...emailRows.map((row) => row.handoffs), 1);
  const maxConversations = Math.max(...emailRows.map((row) => row.conversations), 1);

  return (
    <div className="gencouv-premium">
      {children}

      <section className="admin-page gencouv-reconcile">
        <p className="gencouv-section-label">Conversation intelligence</p>
        <section id="telegram-conversation-gap" className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2><Bot size={18} /> Telegram conversation reconciliation</h2>
              <p>Compare Gencouv Telegram handoffs with genuine conversations you actually receive. Window: last 30 days.</p>
            </div>
            <span className="admin-status live">manual truth layer</span>
          </div>

          <div className="admin-metric-grid">
            <MetricCard icon={Users} tone="cyan" label="Telegram handoffs" value={handoffs} detail="Unique website visitors who clicked @gencouv" trend="30d" />
            <MetricCard icon={Bot} tone="emerald" label="Real conversations" value={genuineConversations} detail="Genuine new Telegram chats recorded" trend="30d" />
            <MetricCard icon={LineChart} tone="violet" label="Handoff → chat" value={`${handoffToConversationRate}%`} detail="Actual conversations ÷ Telegram handoffs" trend="conversion" />
            <MetricCard icon={Users} tone="amber" label="Conversation gap" value={gap} detail="Handoffs with no recorded conversation" trend="diagnostic" />
          </div>

          <div className="gencouv-chart-grid">
            <article className="gencouv-chart-card">
              <h3>Telegram handoffs by email</h3>
              <p>Unique handoff sessions attributed to each primary-sequence email.</p>
              <div className="gencouv-bars">
                {emailRows.map((row) => (
                  <div className="gencouv-bar-row" key={`handoff-${row.emailNumber}`}>
                    <span className="gencouv-bar-label">Email {row.emailNumber}</span>
                    <span className="gencouv-bar-track"><span className="gencouv-bar-fill" style={{ width: `${Math.max((row.handoffs / maxHandoffs) * 100, row.handoffs ? 8 : 0)}%` }} /></span>
                    <span className="gencouv-bar-value">{row.handoffs}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="gencouv-chart-card">
              <h3>Real conversations by email</h3>
              <p>Recorded genuine Telegram conversations attributed to Email 1–7.</p>
              <div className="gencouv-bars">
                {emailRows.map((row) => (
                  <div className="gencouv-bar-row" key={`conversation-${row.emailNumber}`}>
                    <span className="gencouv-bar-label">Email {row.emailNumber}</span>
                    <span className="gencouv-bar-track"><span className="gencouv-bar-fill secondary" style={{ width: `${Math.max((row.conversations / maxConversations) * 100, row.conversations ? 8 : 0)}%` }} /></span>
                    <span className="gencouv-bar-value">{row.conversations}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="gencouv-reconcile-grid">
            <div className="admin-panel" style={{ margin: 0 }}>
              <div className="admin-panel-header">
                <div>
                  <h2 style={{ fontSize: "1rem" }}>Record a genuine Telegram conversation</h2>
                  <p>Use this once when a new prospect actually messages @gencouv.</p>
                </div>
              </div>
              <form action={recordGencouvTelegramConversationAction} style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ color: "var(--admin-text-muted)", fontSize: ".82rem" }}>Source</span>
                  <select name="source_cohort" defaultValue="unknown" style={{ padding: "11px 12px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-panel)", color: "inherit" }}>
                    <option value="unknown">Unknown / cannot tell</option>
                    <option value="organic">Organic website visitor</option>
                    <option value="email_1">Primary sequence · Email 1</option>
                    <option value="email_2">Primary sequence · Email 2</option>
                    <option value="email_3">Primary sequence · Email 3</option>
                    <option value="email_4">Primary sequence · Email 4</option>
                    <option value="email_5">Primary sequence · Email 5</option>
                    <option value="email_6">Primary sequence · Email 6</option>
                    <option value="email_7">Primary sequence · Email 7</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ color: "var(--admin-text-muted)", fontSize: ".82rem" }}>Optional note</span>
                  <input name="note" maxLength={500} placeholder="e.g. Asked about minimum allocation" style={{ padding: "11px 12px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-panel)", color: "inherit" }} />
                </label>
                <button type="submit" style={{ padding: "11px 14px", borderRadius: 10, border: 0, fontWeight: 700, cursor: "pointer" }}>
                  Record conversation
                </button>
              </form>
            </div>

            <div className="admin-panel" style={{ margin: 0 }}>
              <div className="admin-panel-header">
                <div>
                  <h2 style={{ fontSize: "1rem" }}>Email 1–7 · handoff to real chat</h2>
                  <p>This is the final conversion step the website alone cannot observe.</p>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--admin-text-muted)" }}>
                      <th style={{ padding: "10px 12px" }}>Email</th>
                      <th style={{ padding: "10px 12px" }}>Telegram handoffs</th>
                      <th style={{ padding: "10px 12px" }}>Real conversations</th>
                      <th style={{ padding: "10px 12px" }}>Handoff → chat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailRows.map((row) => (
                      <tr key={row.emailNumber} style={{ borderTop: "1px solid var(--admin-border)" }}>
                        <td style={{ padding: "12px" }}><strong>Email {row.emailNumber}</strong></td>
                        <td style={{ padding: "12px" }}>{row.handoffs}</td>
                        <td style={{ padding: "12px" }}>{row.conversations}</td>
                        <td style={{ padding: "12px" }}>{row.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
