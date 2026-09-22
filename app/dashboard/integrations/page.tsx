import Link from "next/link";
import { Calendar, KeyRound, Mail, Mic2, PlugZap, ShieldCheck } from "@/components/admin/ServerIcons";
import { getPlatformEngineSummary, humanize } from "@/lib/platform-engine";
import IntegrationCredentialControl from "./IntegrationCredentialControl";

export const dynamic = "force-dynamic";

const TENANT_CONFIGURABLE_PROVIDERS = new Set([
  "whatsapp",
  "email",
  "elevenlabs",
  "google_calendar",
  "google_sheets",
]);

type IntegrationsPageProps = {
  searchParams: Promise<{ organizationId?: string }>;
};

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "email") return <Mail size={19} />;
  if (provider === "elevenlabs") return <Mic2 size={19} />;
  if (provider === "google_calendar") return <Calendar size={19} />;
  return <PlugZap size={19} />;
}

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const { organizationId } = await searchParams;
  const { integrations, errors } = await getPlatformEngineSummary();

  const visibleIntegrations = integrations.filter((item) => {
    if (!TENANT_CONFIGURABLE_PROVIDERS.has(item.provider)) return false;
    if (organizationId && item.organization_id !== organizationId) return false;
    return true;
  });

  const configured = visibleIntegrations.filter((item) => item.has_credentials).length;
  const connected = visibleIntegrations.filter((item) => item.status === "connected").length;
  const attention = visibleIntegrations.filter((item) => ["error", "authentication_failed"].includes(item.status)).length;
  const tenantName = organizationId ? visibleIntegrations[0]?.organization_name || "Selected organization" : null;

  return (
    <main className="admin-page dashboard-v2-page integrations-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Connections</p>
          <h1>{tenantName ? `${tenantName} Integrations` : "Integration Center"}</h1>
          <p>Connect the customer-facing services each workspace owns. Fluxknight infrastructure remains centrally managed and is not duplicated per client.</p>
        </div>
        {organizationId ? <Link className="admin-button secondary-button" href={`/dashboard/clients/${organizationId}/setup`}>Back to client setup</Link> : null}
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><PlugZap size={15} /> Available</p><strong>{visibleIntegrations.length}</strong><span>Tenant-owned provider records</span></article>
        <article className="admin-metric-card"><p><KeyRound size={15} /> Configured</p><strong>{configured}</strong><span>Credentials stored securely</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> Connected</p><strong>{connected}</strong><span>Verified provider connections</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> Attention</p><strong>{attention}</strong><span>Authentication or provider issues</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Connected Apps</h2><p>Configure workspace-owned channels without exposing unrelated platform infrastructure.</p></div>
          <PlugZap size={18} />
        </div>

        <div className="integration-marketplace">
          {visibleIntegrations.map((item) => {
            const healthMessage = typeof item.health?.message === "string" ? item.health.message : "No health check has run yet.";
            const unhealthy = ["error", "authentication_failed"].includes(item.status);
            return (
              <article className="integration-card" key={item.id}>
                <span className="integration-card-icon"><ProviderIcon provider={item.provider} /></span>
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <h3>{item.display_name}</h3>
                      <p>{item.organization_name} · {humanize(item.provider)}</p>
                    </div>
                    <span className={unhealthy ? "admin-status warning" : item.status === "connected" ? "admin-status live" : "admin-status"}>{humanize(item.status)}</span>
                  </div>
                  <p>{healthMessage}</p>
                  <IntegrationCredentialControl integration={{
                    id: item.id,
                    provider: item.provider,
                    status: item.status,
                    has_credentials: item.has_credentials,
                    secret_keys: item.secret_keys || [],
                  }} />
                </div>
              </article>
            );
          })}
          {!visibleIntegrations.length ? <div className="admin-empty-state"><div><PlugZap size={20} /><p>No tenant-owned connection is required yet. Relevant providers appear when an assigned agent or channel needs them.</p></div></div> : null}
        </div>
      </section>

      {errors.length ? (
        <section className="admin-panel">
          <div className="admin-list-row compact attention-danger"><div><strong>Connection setup attention</strong><span>{errors.join(" · ")}</span></div><ShieldCheck size={16} /></div>
        </section>
      ) : null}
    </main>
  );
}
