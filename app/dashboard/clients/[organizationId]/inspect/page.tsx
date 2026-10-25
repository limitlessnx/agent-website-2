import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationOperationalSnapshot, emptyOrganizationOperationalSnapshot } from "@/lib/admin-organization-data";
import type { AdminOrganizationScope } from "@/lib/admin-organization-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ organizationId: string }> };

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(date);
}

export default async function TenantInspectionPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard/clients");

  const { organizationId } = await params;
  if (!organizationId || organizationId.length > 128) notFound();

  const admin = createAdminClient();
  const { data: organization, error } = await admin
    .from("organizations")
    .select("id,name,slug,status,created_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !organization) notFound();

  const scope: AdminOrganizationScope = {
    kind: "tenant",
    contextId: String(organization.id),
    organizationId: String(organization.id),
    name: String(organization.name || "Tenant organization"),
    slug: String(organization.slug || organization.id),
    status: String(organization.status || "unknown"),
    workflowLegacyIds: [],
  };

  const snapshot = await getOrganizationOperationalSnapshot(scope)
    .catch(() => emptyOrganizationOperationalSnapshot(scope.name));
  const formatValue = (value: number | string) => typeof value === "number" ? new Intl.NumberFormat("en-NG").format(value) : value;

  return (
    <main className="admin-page dashboard-v2-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Super Admin · Tenant Inspector</p>
          <h1>{scope.name}</h1>
          <p>Read-only operational view of this tenant’s persisted data. Your admin identity and active workspace are unchanged.</p>
        </div>
        <span className="admin-status-badge" aria-label="Read-only mode">Read-only</span>
      </div>

      <section className="admin-panel" aria-label="Tenant details">
        <div className="admin-panel-header"><div><h2>Workspace details</h2><p>Tenant identity and current registration state.</p></div></div>
        <div className="admin-metric-grid">
          <article className="admin-metric-card"><p>Organization</p><strong>{scope.name}</strong><span>{scope.slug}</span></article>
          <article className="admin-metric-card"><p>Registration status</p><strong>{scope.status.replaceAll("_", " ")}</strong><span>Current organization record</span></article>
          <article className="admin-metric-card"><p>Created</p><strong>{organization.created_at ? displayDate(String(organization.created_at)) : "Not recorded"}</strong><span>Organization record</span></article>
          <article className="admin-metric-card"><p>Snapshot</p><strong>Live query</strong><span>Loaded {displayDate(new Date().toISOString())}</span></article>
        </div>
      </section>

      <section className="admin-panel" aria-label="Tenant operational metrics">
        <div className="admin-panel-header"><div><h2>Operational overview</h2><p>Counts are calculated from records scoped to this organization.</p></div></div>
        <div className="admin-metric-grid">
          {snapshot.metrics.map((metric) => <article className="admin-metric-card" key={metric.label}><p>{metric.label}</p><strong>{formatValue(metric.value)}</strong><span>{metric.detail}</span></article>)}
        </div>
      </section>

      <section className="admin-panel" aria-label="Tenant agents">
        <div className="admin-panel-header"><div><h2>Agents and systems</h2><p>Operational signals reported by the tenant snapshot.</p></div></div>
        {snapshot.agents.length ? <div className="admin-list">{snapshot.agents.map((agent) => <article className="admin-list-row" key={agent.name}><div style={{ flex: 1 }}><strong>{agent.name}</strong><span>{agent.role} · {agent.channel}</span><span>{agent.note}</span></div><em>{agent.status}</em></article>)}</div> : <p className="admin-empty">No agent records are available in this snapshot.</p>}
      </section>

      <section className="admin-panel" aria-label="Tenant alerts">
        <div className="admin-panel-header"><div><h2>Needs attention</h2><p>Open operational notices returned for this tenant.</p></div></div>
        {snapshot.notices.length ? <div className="admin-list">{snapshot.notices.map((notice, index) => <article className="admin-list-row" key={notice.title + index}><div style={{ flex: 1 }}><strong>{notice.title}</strong><span>{notice.detail}</span></div><em>{notice.type}</em></article>)}</div> : <p className="admin-empty">No unresolved notices were returned.</p>}
      </section>

      <section className="admin-panel" aria-label="Tenant conversations and activity">
        <div className="admin-panel-header"><div><h2>Recent conversations and activity</h2><p>Read-only records. No actions, edits, or tenant mutations are available from this inspector.</p></div></div>
        {snapshot.conversations.length || snapshot.activity.length ? <div className="admin-list">
          {snapshot.conversations.slice(0, 8).map((item) => <article className="admin-list-row" key={"conversation-" + item.id}><div style={{ flex: 1 }}><strong>{item.title}</strong><span>{item.meta}</span></div><em>{item.label}</em></article>)}
          {snapshot.activity.slice(0, 8).map((item) => <article className="admin-list-row" key={"activity-" + item.id}><div style={{ flex: 1 }}><strong>{item.title}</strong><span>{item.meta}</span></div><em>{item.label}</em></article>)}
        </div> : <p className="admin-empty">No recent conversation or activity records were returned for this tenant.</p>}
      </section>
      <p className="admin-empty">Inspection is read-only. To make changes, leave this view and use the normal, permission-checked tenant workflow.</p>
    </main>
  );
}
