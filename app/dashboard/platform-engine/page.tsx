import {
  Bot,
  Boxes,
  BrainCircuit,
  Building2,
  Database,
  PlugZap,
  Workflow,
} from "@/components/admin/ServerIcons";
import { getPlatformEngineSummary, humanize } from "@/lib/platform-engine";

export const dynamic = "force-dynamic";

export default async function PlatformEnginePage() {
  const summary = await getPlatformEngineSummary();
  const connected = summary.integrations.filter((item) => item.status === "connected").length;
  const readyKnowledge = summary.knowledge.filter((item) => item.status === "active").length;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Platform Engine</p>
          <h1>Provision and operate organization AI systems</h1>
          <p>
            Templates, integration health, organization knowledge and customer memory now share one platform layer.
          </p>
        </div>
      </header>

      <section className="admin-metric-grid">
        <article className="admin-metric-card"><p><Boxes size={15} /> Templates</p><strong>{summary.templates.length}</strong><span>Reusable organization blueprints</span></article>
        <article className="admin-metric-card"><p><PlugZap size={15} /> Integrations</p><strong>{connected}/{summary.integrations.length}</strong><span>Connected organization services</span></article>
        <article className="admin-metric-card"><p><Database size={15} /> Knowledge</p><strong>{readyKnowledge}</strong><span>Active knowledge collections</span></article>
        <article className="admin-metric-card"><p><BrainCircuit size={15} /> Memory</p><strong>{summary.memories.length}</strong><span>Recent customer memory records</span></article>
      </section>

      {summary.errors.length ? (
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Platform migration required</h2><p>Apply the latest Supabase migration to activate all engine modules.</p></div></div>
          <div className="admin-list">
            {summary.errors.map((error) => <div className="admin-list-row compact" key={error}><div><strong>Module unavailable</strong><span>{error}</span></div></div>)}
          </div>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Organization Template Library</h2><p>Deploy repeatable AI workforces instead of rebuilding clients manually.</p></div><Boxes size={18} /></div>
        <div className="admin-list">
          {summary.templates.map((template) => (
            <article className="admin-list-row" key={template.id}>
              <div>
                <strong>{template.name}</strong>
                <span>{template.industry} · {template.description || "Reusable organization blueprint"}</span>
                <span>{template.modules.map(humanize).join(" · ")}</span>
              </div>
              <div>
                <em>{template.agents.length} agents</em>
                <span>{template.workflows.length} workflows</span>
              </div>
            </article>
          ))}
          {!summary.templates.length ? <p className="admin-empty">Template records will appear after the platform migration is applied.</p> : null}
        </div>
      </section>

      <section className="admin-grid-2">
        <article className="admin-panel">
          <div className="admin-panel-header"><div><h2>Platform modules</h2><p>One familiar operating pattern across every organization.</p></div><Building2 size={18} /></div>
          <div className="admin-list">
            <a className="admin-list-row compact" href="/dashboard/clients"><div><strong>Organization Manager</strong><span>Onboarding, provisioning and lifecycle stages</span></div><Building2 size={16} /></a>
            <a className="admin-list-row compact" href="/dashboard/integrations"><div><strong>Integration Center</strong><span>Organization-scoped provider health and credentials</span></div><PlugZap size={16} /></a>
            <a className="admin-list-row compact" href="/dashboard/knowledge"><div><strong>Knowledge Center</strong><span>Collections, sources and agent retrieval readiness</span></div><Database size={16} /></a>
            <a className="admin-list-row compact" href="/dashboard/memory"><div><strong>Memory Center</strong><span>Customer history, preferences and durable context</span></div><BrainCircuit size={16} /></a>
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel-header"><div><h2>Provisioning contract</h2><p>What Fluxknight should create from a selected template.</p></div><Workflow size={18} /></div>
          <div className="admin-list">
            {["Organization and main branch", "Agent family and starter project", "Selected AI agents", "Workflow placeholders", "Knowledge collections", "Integration requirements", "Audit and activity records"].map((item) => (
              <div className="admin-list-row compact" key={item}><div><strong>{item}</strong><span>Provisioned under organization scope</span></div><Bot size={15} /></div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
