type Enrollment = {
  id?: string;
  lead_id?: string;
  normalized_email?: string;
  cohort_date?: string;
  campaign_status?: string;
  validation_status?: string;
  qualification_status?: string;
  current_sequence_step?: number;
  next_follow_up_at?: string;
  last_delivery_status?: string;
  reply_status?: string;
  stop_reason?: string;
  created_at?: string;
};

function formatDate(value?: string) {
  if (!value) return "No cohort";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function formatTime(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function GencouvCohorts({ enrollments }: { enrollments: Enrollment[] }) {
  const groups = new Map<string, Enrollment[]>();
  for (const enrollment of enrollments) {
    const key = enrollment.cohort_date || "unknown";
    groups.set(key, [...(groups.get(key) || []), enrollment]);
  }
  const cohorts = Array.from(groups.entries()).sort(([left], [right]) => right.localeCompare(left));

  return (
    <section id="daily-cohorts" className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Daily cohorts</h2>
          <p>New qualified campaign enrollments are grouped by cohort date. Follow-up emails are tracked separately.</p>
        </div>
        <span className="admin-status live">{enrollments.length} enrollments</span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {cohorts.length ? cohorts.map(([date, rows]) => {
          const enrolled = rows.filter((row) => row.campaign_status && !["rejected", "blocked"].includes(row.campaign_status)).length;
          const stopped = rows.filter((row) => row.stop_reason || ["stopped", "do_not_contact"].includes(row.campaign_status || "")).length;
          const replies = rows.filter((row) => row.reply_status && row.reply_status !== "none").length;
          return (
            <details key={date} style={{ border: "1px solid var(--admin-border)", borderRadius: 14, overflow: "hidden" }}>
              <summary style={{ cursor: "pointer", listStyle: "none", padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, alignItems: "center" }}>
                <strong>{formatDate(date)}</strong>
                <span>Qualified: {rows.length}</span>
                <span>Enrolled: {enrolled}</span>
                <span>Replies: {replies}</span>
                <span>Stopped: {stopped}</span>
              </summary>
              <div style={{ borderTop: "1px solid var(--admin-border)", padding: 14, display: "grid", gap: 8 }}>
                {rows.map((row) => (
                  <div key={row.id || row.normalized_email} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--admin-surface-soft)", minWidth: 0 }}>
                    <span style={{ overflowWrap: "anywhere" }}>{row.normalized_email}</span>
                    <span className="admin-status">{row.campaign_status || "queued"}</span>
                    <span>Step {row.current_sequence_step || 0}</span>
                    <span style={{ color: "var(--admin-text-muted)", fontSize: ".82rem" }}>{formatTime(row.next_follow_up_at)}</span>
                    <small style={{ gridColumn: "1 / -1", color: "var(--admin-text-muted)" }}>
                      Validation: {row.validation_status || "pending"} · Qualification: {row.qualification_status || "pending"} · Delivery: {row.last_delivery_status || "none"} · Reply: {row.reply_status || "none"}{row.stop_reason ? ` · Stop: ${row.stop_reason}` : ""}
                    </small>
                  </div>
                ))}
              </div>
            </details>
          );
        }) : <p style={{ margin: 0, color: "var(--admin-text-muted)" }}>No campaign cohorts recorded yet.</p>}
      </div>
    </section>
  );
}
