import FollowupControlCenter from "@/components/admin/FollowupControlCenter";
import { getFollowupControlSummary } from "@/lib/followup-control";
import { getLeads } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const [summary, leads] = await Promise.all([
    getFollowupControlSummary("limitless-realty"),
    getLeads(1000).catch(() => []),
  ]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Follow-up Control</h1>
          <p>Manage reminders, reusable sequences, enrolled leads and n8n execution activity from one clean workspace.</p>
        </div>
        <span className={summary.workflows.some((item) => item.active) ? "admin-status live" : "admin-status warning"}>
          {summary.workflows.filter((item) => item.active).length} active n8n workflows
        </span>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p>Active enrollments</p><strong>{summary.enrollments.filter((item) => item.status === "active").length}</strong><span>Currently inside a sequence</span></article>
        <article className="admin-metric-card"><p>Scheduled next</p><strong>{summary.enrollments.filter((item) => item.next_run_at && item.status === "active").length}</strong><span>Waiting for the next action</span></article>
        <article className="admin-metric-card"><p>Sequences</p><strong>{summary.sequences.length}</strong><span>Variable-length reusable plans</span></article>
        <article className="admin-metric-card"><p>n8n activity</p><strong>{summary.executions.length}</strong><span>Relevant recent executions</span></article>
      </div>

      <FollowupControlCenter
        configured={summary.configured}
        leads={leads.map((lead) => ({ id:String(lead.id), name:String(lead.name || ""), phone:String(lead.phone || "") }))}
        sequences={summary.sequences}
        steps={summary.steps}
        enrollments={summary.enrollments}
        workflows={summary.workflows.map((item) => ({ id:item.id, name:item.name, active:item.active }))}
        executions={summary.executions.map((item) => ({ id:item.id, workflowId:item.workflowId, status:item.status, startedAt:item.startedAt, stoppedAt:item.stoppedAt }))}
      />
    </div>
  );
}
