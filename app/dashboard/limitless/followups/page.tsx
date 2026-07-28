import FollowupControlCenter from "@/components/admin/FollowupControlCenter";
import { getFollowupControlSummary } from "@/lib/followup-control";
import { getLeads } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const [summary, leads] = await Promise.all([
    getFollowupControlSummary("limitless-realty"),
    getLeads(1000).catch(() => []),
  ]);

  const active = summary.enrollments.filter((item) => item.status === "active").length;
  const scheduled = summary.enrollments.filter((item) => item.next_run_at && item.status === "active").length;
  const attention = summary.enrollments.filter((item) => item.status === "failed").length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Follow-up Control</h1>
          <p>Manage reminders, reusable sequences and enrolled leads from one clean workspace.</p>
        </div>
        <span className={attention ? "admin-status warning" : "admin-status live"}>
          {attention ? `${attention} need attention` : "Automation healthy"}
        </span>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p>Active follow-ups</p><strong>{active}</strong><span>Currently inside a sequence</span></article>
        <article className="admin-metric-card"><p>Scheduled next</p><strong>{scheduled}</strong><span>Waiting for the next action</span></article>
        <article className="admin-metric-card"><p>Sequences</p><strong>{summary.sequences.length}</strong><span>Reusable follow-up plans</span></article>
        <article className="admin-metric-card"><p>Needs attention</p><strong>{attention}</strong><span>Failed actions requiring review</span></article>
      </div>

      <FollowupControlCenter
        configured={summary.configured}
        leads={leads.map((lead) => ({ id:String(lead.id), name:String(lead.name || ""), phone:String(lead.phone || "") }))}
        sequences={summary.sequences}
        steps={summary.steps}
        enrollments={summary.enrollments}
      />
    </div>
  );
}