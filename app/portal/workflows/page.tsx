import { Activity, Workflow } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import { getClientPortalSummary } from "@/lib/client-portal-data";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function PortalWorkflowsPage() {
  const session = await getClientSession();
  if (!session) return null;
  const summary = await getClientPortalSummary(session.organizationId);

  return (
    <main className="portal-page">
      <header className="portal-section-title"><h1>Workflows</h1><p>See which automations belong to your organization and how recently they have run.</p></header>
      <section className="portal-card">
        <div className="portal-card-head"><div><h2><Workflow size={17} /> Registered workflows</h2><p>Tenant-scoped automation registry.</p></div></div>
        <div className="portal-list">
          {summary.workflows.map((workflow) => (
            <div className="portal-list-row" key={workflow.id}>
              <div><strong>{workflow.name}</strong><span>{workflow.provider} · {workflow.trigger_type || "webhook"} · {workflow.environment || "production"} · Last run {formatDate(workflow.last_run_at)}</span></div>
              <em>{workflow.status}</em>
            </div>
          ))}
          {!summary.workflows.length ? <p className="portal-empty">No workflows have been connected to this workspace yet.</p> : null}
        </div>
      </section>
      <section className="portal-card">
        <div className="portal-card-head"><div><h2><Activity size={17} /> Recent runs</h2><p>Latest execution results.</p></div></div>
        <div className="portal-list">
          {summary.runs.map((run) => (
            <div className="portal-list-row" key={run.id}>
              <div><strong>{run.workflow_key}</strong><span>{formatDate(run.created_at)} · {run.duration_ms ? `${run.duration_ms} ms` : "duration pending"}</span></div>
              <em>{run.status}</em>
            </div>
          ))}
          {!summary.runs.length ? <p className="portal-empty">No workflow runs have been recorded.</p> : null}
        </div>
      </section>
    </main>
  );
}
