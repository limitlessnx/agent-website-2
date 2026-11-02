import FollowupControlCenter from "@/components/admin/FollowupControlCenter";
import { getFollowupControlSummary } from "@/lib/followup-control";
import { getLeads, LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const [summaryResult, leads] = await Promise.all([
    getFollowupControlSummary(LIMITLESS_REALTY_ORGANIZATION_ID)
      .then((summary) => ({ summary, error: "" }))
      .catch(() => ({ summary: null, error: "Follow-up records could not be loaded. The page is available, but its live data needs attention." })),
    getLeads(1000).catch(() => []),
  ]);
  const summaryError = summaryResult.error;
  const summary = summaryResult.summary || {
    configured: false,
    asOf: Date.now(),
    sequences: [],
    steps: [],
    enrollments: [],
    logs: [],
    statusSummary: { upcoming: 0, due: 0, overdue: 0, completed: 0, failed: 0, cancelled: 0, paused: 0, optedOut: 0, stopped: 0, closed: 0, unknown: 0, draft: 0, unscheduled: 0 },
  };

  const active = summary.enrollments.filter((item) => item.status === "active").length;
  const scheduled = summary.statusSummary.upcoming;
  const dueNow = summary.statusSummary.due;
  const overdue = summary.statusSummary.overdue;
  const logFailures = summary.logs.filter((item: { status?: string | null }) => ["failed", "error", "blocked", "unknown"].includes(String(item.status).toLowerCase())).length;
  const attention = logFailures;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Follow-up Control</h1>
          <p>Manage Maia-managed reminders and follow-up actions from one clean workspace.</p>
        </div>
        <span className={attention ? "admin-status warning" : "admin-status live"}>
          {attention ? `${attention} need attention` : "Automations healthy"}
        </span>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p>Active follow-ups</p><strong>{active}</strong><span>Currently inside a sequence</span></article>
        <article className="admin-metric-card"><p>Upcoming</p><strong>{scheduled}</strong><span>Waiting for the next action</span></article>
        <article className="admin-metric-card"><p>Due now</p><strong>{dueNow}</strong><span>Ready for today&apos;s step</span></article>
        <article className="admin-metric-card"><p>Overdue</p><strong>{overdue}</strong><span>Missed by more than 24 hours</span></article>
        <article className="admin-metric-card"><p>Built-in cadence</p><strong>Ongoing</strong><span>Maia steps: days 1, 3, 7, 14, 21, 30, then every 14 days</span></article>
        <article className="admin-metric-card"><p>Needs attention</p><strong>{attention}</strong><span>Failed or blocked actions requiring review</span></article>
      </div>

      <FollowupControlCenter
        configured={summary.configured}
        now={summary.asOf}
        leads={leads.map((lead) => ({ id:String(lead.id), name:String(lead.name || ""), phone:String(lead.phone || "") }))}
        sequences={summary.sequences}
        steps={summary.steps}
        enrollments={summary.enrollments}
        logs={summary.logs}
        automationIssues={attention}
      />
    </div>
  );
}
