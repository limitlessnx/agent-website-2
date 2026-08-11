import Link from "next/link";
import { KeyRound, PlugZap, ShieldCheck } from "lucide-react";
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
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Tenant connections</p>
          <h1>{tenantName ? `${tenantName} Integrations` : "Integration Center"}</h1>
          <p>Configure only tenant-owned external channels and services. Fluxknight infrastructure such as Supabase, n8n and platform AI-provider credentials is managed centrally and is not repeated for each client.</p>
        </div>
        {organizationId ? <Link className="admin-button secondary" href={`/dashboard/clients/${organizationId}/setup`}>Back to client setup</Link> : null}
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><PlugZap size={15} /> Required</p><strong>{visibleIntegrations.length}</strong><span>Tenant-owned provider records</span></article>
        <article className="admin-metric-card"><p><KeyRound size={15} /> Configured</p><strong>{configured}</strong><span>Credentials stored securely</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> Connected</p><strong>{connected}</strong><span>Verified tenant connections</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> Attention</p><strong>{attention}</strong><span>Authentication or provider errors</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Tenant-owned integrations</h2><p>Only configure credentials that belong to the client's channels or external services.</p></div>
          <PlugZap size={18} />
        </div>
        <div className="admin-list">
          {visibleIntegrations.map((item) => {
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
          {!visibleIntegrations.length ? <p className="admin-empty">No tenant-owned connection is required yet. Relevant providers appear here when an assigned agent or channel needs them.</p> : null}
        </div>
      </section>

      {errors.length ? (
        <section className="admin-panel">
          <div className="admin-list-row compact"><div><strong>Connection setup attention</strong><span>{errors.join(" · ")}</span></div><ShieldCheck size={16} /></div>
        </section>
      ) : null}
    </main>
  );
}
