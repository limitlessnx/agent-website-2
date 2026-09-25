import { AlertTriangle, CheckCircle2, MessageSquareText, PhoneCall, UserCheck } from "@/components/admin/ServerIcons";
import { resolveAdminOrganizationScope, organizationHomeHref } from "@/lib/admin-organization-scope";
import { emptyOrganizationOperationalSnapshot, getOrganizationOperationalSnapshot } from "@/lib/admin-organization-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const scope = await resolveAdminOrganizationScope();
  const [snapshot, workflowSummary] = await Promise.all([
    getOrganizationOperationalSnapshot(scope).catch(() => emptyOrganizationOperationalSnapshot(scope.name)),
    getWorkflowRegistrySummary(scope).catch(() => ({ configured: false, workflows: [], runs: [], active: 0, paused: 0, failures: 0, successRate: 0 })),
  ]);

  const conversations = snapshot.conversations.slice(0, 12);
  const selected = conversations[0] || null;
  const automationHealthy = workflowSummary.configured ? workflowSummary.failures === 0 : true;
  const workspaceHref = organizationHomeHref(scope);

  return (
    <main className="admin-page dashboard-v2-page conversations-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">{scope.name}</p>
          <h1>Conversation Center</h1>
          <p>Conversation evidence, follow-up pressure and handoff signals are restricted to the active organization workspace.</p>
        </div>
        <span className={snapshot.attentionCount ? "admin-status warning" : "admin-status live"}>
          {snapshot.attentionCount ? `${snapshot.attentionCount} need attention` : "Inbox stable"}
        </span>
      </header>

      <div className="admin-metric-grid">
        <section className="admin-panel compact"><p>Visible conversations</p><strong>{conversations.length}</strong><span className="admin-muted">{scope.name} only</span></section>
        <section className="admin-panel compact"><p>Need attention</p><strong>{snapshot.attentionCount}</strong><span className="admin-muted">Follow-up or handoff signals</span></section>
        <section className="admin-panel compact"><p>Active automations</p><strong>{workflowSummary.active}</strong><span className="admin-muted">Scoped workflow registry</span></section>
        <section className="admin-panel compact"><p>Automation state</p><strong>{automationHealthy ? "Live" : "Check"}</strong><span className="admin-muted">Fails soft if providers are unavailable</span></section>
      </div>

      <section className="admin-panel conversation-workspace" aria-label="Conversation workspace">
        <aside className="conversation-pane">
          <div className="conversation-pane-head">
            <div><h2>Inbox</h2><p>Recent {scope.name} conversation and lead activity.</p></div>
            <MessageSquareText size={17} />
          </div>
          <div className="admin-list conversation-list">
            {conversations.map((item, index) => (
              <a href={item.href} className={`admin-list-row compact conversation-row ${index === 0 ? "is-selected" : ""}`} key={item.id}>
                <div><strong>{item.title}</strong><span>{item.meta}</span></div>
                <em className={item.tone === "warning" ? "bad" : "muted"}>{item.label}</em>
              </a>
            ))}
            {!conversations.length ? <p className="admin-empty">No conversation evidence is stored for {scope.name} yet.</p> : null}
          </div>
        </aside>

        <section className="conversation-pane">
          <div className="conversation-pane-head">
            <div><h2>{selected?.title || "Conversation"}</h2><p>{selected?.meta || "No active conversation is available in this organization."}</p></div>
            {selected ? <span className={selected.tone === "warning" ? "admin-status warning" : "admin-status live"}>{selected.label}</span> : null}
          </div>
          {selected ? (
            <>
              <div className="conversation-thread" aria-label="Conversation summary">
                <div className="conversation-bubble">This view only uses evidence attached to {scope.name}.</div>
                <div className="conversation-bubble ai">If a live dependency is unavailable, the page remains usable and shows the last persisted organization evidence instead of failing the entire workspace.</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <a className="admin-button primary-button" href={selected.href}><UserCheck size={14} /> Open record</a>
                <a className="admin-button secondary-button" href={workspaceHref}>Open {scope.name}</a>
              </div>
            </>
          ) : <div className="admin-empty-state"><div><MessageSquareText size={20} /><p>No conversation selected.</p></div></div>}
        </section>

        <aside className="conversation-pane">
          <div className="conversation-pane-head">
            <div><h2>Context</h2><p>Organization scope and operating state.</p></div>
            <PhoneCall size={17} />
          </div>
          <div className="conversation-context-card"><span className="admin-kicker">ORGANIZATION</span><strong>{scope.name}</strong><span className="admin-muted">{scope.kind === "system" ? "System organization" : "Tenant organization"}</span></div>
          <div className="conversation-context-card"><span className="admin-kicker">AUTOMATIONS</span><strong>{workflowSummary.active} active</strong><span className="admin-muted">{workflowSummary.workflows.length} scoped workflows visible.</span></div>
          <div className="conversation-context-card"><span className="admin-kicker">SYSTEM</span><strong>{automationHealthy ? "Available" : "Needs review"}</strong><span className="admin-muted">Dependency outages no longer replace this page with an error screen.</span></div>
        </aside>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Needs your attention</h2><p>Signals from {scope.name} only.</p></div><AlertTriangle size={18} /></div>
        <div className="admin-list">
          {snapshot.notices.map((notice, index) => (
            <a href={notice.href} className="admin-list-row compact attention-warning" key={notice.title + index}>
              <div><strong>{notice.title}</strong><span>{notice.detail}</span></div><em>{notice.type}</em>
            </a>
          ))}
          {!snapshot.notices.length ? <div className="admin-list-row compact"><div><strong>No urgent conversation issues</strong><span>No stored signals currently require review.</span></div><CheckCircle2 size={17} /></div> : null}
        </div>
      </section>
    </main>
  );
}
