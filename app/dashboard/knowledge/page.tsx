import { Database, FileText } from "@/components/admin/ServerIcons";
import { getPlatformEngineSummary, humanize } from "@/lib/platform-engine";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const { knowledge, errors } = await getPlatformEngineSummary();
  return (
    <main className="admin-page">
      <header className="admin-page-header"><div><p className="admin-kicker">Platform Engine</p><h1>Knowledge Center</h1><p>Organize verified business information before agents are allowed to answer from it.</p></div></header>
      <section className="admin-metric-grid">
        <article className="admin-metric-card"><p><Database size={15} /> Collections</p><strong>{knowledge.length}</strong><span>Organization knowledge containers</span></article>
        <article className="admin-metric-card"><p><FileText size={15} /> Sources</p><strong>{knowledge.reduce((total, item) => total + Number(item.source_count || 0), 0)}</strong><span>Registered source records</span></article>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Knowledge collections</h2><p>Properties, FAQs, pricing, policies and operational guides live here.</p></div><Database size={18} /></div>
        <div className="admin-list">
          {knowledge.map((item) => <div className="admin-list-row" key={item.id}><div><strong>{item.name}</strong><span>{item.description || "No description"}</span><span>{item.source_count} sources</span></div><em>{humanize(item.status)}</em></div>)}
          {!knowledge.length ? <p className="admin-empty">No knowledge collections have been provisioned yet.</p> : null}
        </div>
      </section>
      {errors.length ? <p className="admin-empty">{errors.join(" · ")}</p> : null}
    </main>
  );
}
