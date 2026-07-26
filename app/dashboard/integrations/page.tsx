import { PlugZap, ShieldCheck } from "lucide-react";
import { getPlatformEngineSummary, humanize } from "@/lib/platform-engine";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { integrations, errors } = await getPlatformEngineSummary();
  return (
    <main className="admin-page">
      <header className="admin-page-header"><div><p className="admin-kicker">Platform Engine</p><h1>Integration Center</h1><p>Organization-scoped provider status, health and connection references.</p></div></header>
      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Connected services</h2><p>Secrets remain outside readable dashboard fields.</p></div><PlugZap size={18} /></div>
        <div className="admin-list">
          {integrations.map((item) => <div className="admin-list-row" key={item.id}><div><strong>{item.display_name}</strong><span>{humanize(item.provider)} · Last checked {item.last_checked_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.last_checked_at)) : "not yet"}</span></div><em>{humanize(item.status)}</em></div>)}
          {!integrations.length ? <p className="admin-empty">No organization integrations are registered yet.</p> : null}
        </div>
      </section>
      {errors.length ? <section className="admin-panel"><div className="admin-list-row compact"><div><strong>Migration or connection setup required</strong><span>{errors.join(" · ")}</span></div><ShieldCheck size={16} /></div></section> : null}
    </main>
  );
}
