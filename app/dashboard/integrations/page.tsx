import { KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import { getPlatformEngineSummary, humanize } from "@/lib/platform-engine";
import IntegrationCredentialControl from "./IntegrationCredentialControl";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { integrations, errors } = await getPlatformEngineSummary();
  const configured = integrations.filter((item) => item.has_credentials).length;
  const connected = integrations.filter((item) => item.status === "connected").length;
  const attention = integrations.filter((item) => ["error", "authentication_failed"].includes(item.status)).length;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Platform Engine</p>
          <h1>Integration Center</h1>
          <p>Configure organization providers using encrypted Supabase Vault storage. Secret values are never returned to the dashboard.</p>
        </div>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><PlugZap size={15} /> Registered</p><strong>{integrations.length}</strong><span>Organization provider records</span></article>
        <article className="admin-metric-card"><p><KeyRound size={15} /> Configured</p><strong>{configured}</strong><span>Credentials stored in Vault</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> Connected</p><strong>{connected}</strong><span>Verified provider connections</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> Attention</p><strong>{attention}</strong><span>Authentication or provider errors</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Organization integrations</h2><p>Configure or rotate provider credentials without exposing stored secret values.</p></div>
          <PlugZap size={18} />
        </div>
        <div className="admin-list">
          {integrations.map((item) => {
            const healthMessage = typeof item.health?.message === "string" ? item.health.message : "No health check has run yet.";
            return (
              <div className="admin-list-row" key={item.id} style={{ alignItems: "start", gap: 18 }}>
                <div style={{ flex: 1 }}>
                  <strong>{item.display_name}</strong>
                  <span>{item.organization_name} · {humanize(item.provider)}</span>
                  <span>Status: {humanize(item.status)} · {healthMessage}</span>
                  <span>
                    Last checked {item.last_checked_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.last_checked_at)) : "not yet"}
                    {item.last_rotated_at ? ` · Credentials rotated ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(item.last_rotated_at))}` : ""}
                  </span>
                </div>
                <IntegrationCredentialControl integration={{
                  id: item.id,
                  provider: item.provider,
                  status: item.status,
                  has_credentials: item.has_credentials,
                  secret_keys: item.secret_keys || [],
                }} />
              </div>
            );
          })}
          {!integrations.length ? <p className="admin-empty">No organization integrations are registered yet.</p> : null}
        </div>
      </section>

      {errors.length ? (
        <section className="admin-panel">
          <div className="admin-list-row compact"><div><strong>Migration or connection setup required</strong><span>{errors.join(" · ")}</span></div><ShieldCheck size={16} /></div>
        </section>
      ) : null}
    </main>
  );
}