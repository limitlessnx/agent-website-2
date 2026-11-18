import Link from "next/link";
import { PageHeader, DashboardCard, CardHeader, MetricCard, StatusBadge, Button, EmptyState } from "@/components/ui/DashboardPrimitives";
import type { AdminControlCenter, Evidence, OperationSummary } from "@/lib/admin-control-center";
import { organizationCategory, isOrganizationId } from "@/lib/organization-context-catalog";
import styles from "./ControlCenter.module.css";

function OperationsEvidence({ title, source, href, description }: { title: string; source: Evidence<OperationSummary>; href: string; description: string }) {
  const failures = source.rows.filter(row => ["failed", "error", "timeout", "transfer_failed"].includes(row.status));
  const statuses = [...new Set(source.rows.map(row => row.status))];
  return <DashboardCard><CardHeader title={title} description={description} actions={<Button variant="outline" href={href}>Open diagnostics</Button>} />
    {!source.available ? <p role="alert">Evidence unavailable. Refresh to retry; health is unknown.</p> : <>
      <p className={styles.status}><StatusBadge tone={failures.length ? "warning" : "neutral"}>{failures.length} failures in sample</StatusBadge><span>{source.rows.length}{source.truncated ? "+" : ""} records · last 24 hours</span></p>
      {source.truncated ? <p className={styles.note}>Latest 100 records shown; this is not a platform total.</p> : null}
      <p className={styles.note}>{statuses.length ? `Recorded states: ${statuses.join(", ")}.` : "No recorded activity in this window. Availability has not been verified."}</p>
      {failures.length ? <ul className={styles.evidence}>{failures.slice(0, 5).map(row => <li key={row.id}><strong>{row.status.replaceAll("_", " ")}</strong><span>Organization: {row.organization_id || "Platform event"}</span><small>Record {row.id}</small>{isOrganizationId(row.organization_id) ? <Link href={`/dashboard/clients/${row.organization_id}/manage`}>Review affected organization</Link> : null}</li>)}</ul> : null}
    </>}
  </DashboardCard>;
}

export default function PlatformControlCenter({ data }: { data: AdminControlCenter }) {
  const orgs = data.organizations;
  const failures = data.jobs.rows.filter(row => row.status === "failed");
  const attention = data.integrations.rows.filter(row => ["error", "authentication_failed", "disconnected"].includes(row.status));
  return <main className="admin-page dashboard-v2-page"><div className={styles.stack}>
    <PageHeader kicker="Platform administration" title="Super Admin Control Center" description="Review organization context, provisioning evidence and operational failures. Workspace selection does not grant tenant membership." actions={<Button href="/dashboard/organizations">Manage organizations</Button>} />
    <div className="admin-metric-grid">
      <MetricCard label="Organizations in sample" value={orgs.available ? `${orgs.rows.length}${orgs.truncated ? "+" : ""}` : "—"} detail={orgs.available ? `${orgs.rows.filter(row => organizationCategory(row.slug) === "internal").length} internal · latest 100 organizations` : "Registry unavailable"} />
      <MetricCard label="Failed provisioning jobs" value={data.jobs.available ? failures.length : "—"} detail="Latest 100 jobs · all recorded dates" />
      <MetricCard label="Connections needing attention" value={data.integrations.available ? attention.length : "—"} detail="Latest 300 tenant connection records" />
    </div>
    <DashboardCard><CardHeader title="Operator workspaces" description="Use existing tools for each platform management task." /><div className={styles.actions}>
      <Button href="/dashboard/organizations">Organization registry</Button><Button href="/dashboard/provisioning" variant="outline">Onboarding & provisioning</Button><Button href="/dashboard/integrations" variant="outline">Provider & tenant connections</Button><Button href="/dashboard/billing" variant="outline">Billing & usage</Button><Button href="/dashboard/support" variant="outline">Support & Leo</Button><Button href="/dashboard/settings" variant="outline">Security & settings</Button>
    </div></DashboardCard>
    <div className={styles.grid}>
      <DashboardCard><CardHeader title="Provisioning recovery" description="Recorded job state is separate from overall tenant readiness." actions={<Button href="/dashboard/provisioning" variant="outline">Review readiness</Button>} />
        {!data.jobs.available ? <p role="alert">Provisioning evidence unavailable. Refresh to retry.</p> : <>
          <p className={styles.note}>Latest {data.jobs.rows.length}{data.jobs.truncated ? "+" : ""} jobs. Queued: {data.jobs.rows.filter(row => row.status === "queued").length} · running: {data.jobs.rows.filter(row => row.status === "running").length}. Completed deployment does not imply activation.</p>
          {failures.length ? <ul className={styles.evidence}>{failures.slice(0, 10).map(job => <li key={job.id}><strong>Failed · attempt {job.attempts}/{job.max_attempts}</strong><span>Organization {job.organization_id}</span><Link href={`/dashboard/provisioning?organizationId=${encodeURIComponent(job.organization_id)}`}>Review blockers and recovery</Link></li>)}</ul> : <EmptyState title="No failed jobs in this sample" description="Review readiness before testing or activation." />}
        </>}
      </DashboardCard>
      <DashboardCard><CardHeader title="Tenant connection health" description="Last recorded state, not a live connectivity test." actions={<Button href="/dashboard/integrations" variant="outline">Review integrations</Button>} />
        {!data.integrations.available ? <p role="alert">Tenant connection evidence unavailable. Refresh to retry.</p> : <>
          <p className={styles.note}>Latest {data.integrations.rows.length}{data.integrations.truncated ? "+" : ""} connections. {data.integrations.rows.filter(row => !row.last_checked_at).length} have no recorded health check.</p>
          <ul className={styles.evidence}>{(attention.length ? attention : data.integrations.rows).slice(0, 8).map(item => <li key={item.id}><strong>{item.organization_name} · {item.display_name || item.provider}</strong><span>{item.status.replaceAll("_", " ")} · {item.last_checked_at ? `Last checked ${new Date(item.last_checked_at).toLocaleString("en-GB")}` : "Health check pending"}</span><Link href={`/dashboard/integrations?organizationId=${encodeURIComponent(item.organization_id)}`}>Review organization connection</Link></li>)}</ul>
          {!data.integrations.rows.length ? <p className={styles.note}>No connection records in this sample. Provider availability is unknown.</p> : null}
        </>}
      </DashboardCard>
    </div>
    <div className={styles.grid} id="operations">
      <OperationsEvidence title="Maia processing" source={data.maia} href="/dashboard/agent-operations" description="Inbound event outcomes; no messages are sent from this view." />
      <OperationsEvidence title="Agent tool executions" source={data.tools} href="/dashboard/agent-operations" description="Recorded tool outcomes; pending actions are not successes." />
      <OperationsEvidence title="WhatsApp send attempts" source={data.whatsapp} href="/dashboard/conversations" description="Provider acceptance does not confirm message delivery. Review conversation receipts." />
      <OperationsEvidence title="Transactional email" source={data.email} href="/dashboard/email" description="Recorded send events; sent does not confirm inbox delivery." />
      <OperationsEvidence title="Voice call outcomes" source={data.voice} href="/dashboard/integrations" description="Historical call outcomes do not establish current voice connectivity." />
      <DashboardCard><CardHeader title="Recent administrative actions" description="Latest 20 audit records; identity and recorded outcome are shown when available." />
        {!data.audit.available ? <p role="alert">Administrative audit unavailable. Refresh to retry.</p> : <ul className={styles.evidence}>{data.audit.rows.map(row => <li key={row.id}><strong>{row.action}</strong><span>{row.actorEmail || row.actor_user_id || "Actor not recorded"} · {row.outcome || "Outcome not recorded"}</span><small>Organization {row.organization_id || "Platform"} · {new Date(row.created_at).toLocaleString("en-GB")}</small></li>)}{!data.audit.rows.length ? <li>No audit records in this sample.</li> : null}</ul>}
      </DashboardCard>
    </div>
  </div></main>;
}
