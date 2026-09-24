import Link from "next/link";
import WhatsAppIntegrationPanel from "@/components/integrations/WhatsAppIntegrationPanel";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWhatsAppReadiness, getWhatsAppIntegration } from "@/lib/whatsapp-integration";
import { checkMaiaLiveCutoverReadiness } from "@/lib/maia-cutover-readiness";

export const dynamic = "force-dynamic";

const ORG_SLUG = "limitless-realty";

export default async function LimitlessIntegrationsPage() {
  const admin = createAdminClient();
  const { data: organization } = await admin
    .from("organizations")
    .select("id,name,slug,status")
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (!organization) {
    return (
      <main className="admin-page">
        <header className="admin-page-header">
          <div><p className="admin-kicker">Limitless Realty</p><h1>Connections</h1><p>The workspace organization has not been provisioned yet.</p></div>
        </header>
      </main>
    );
  }

  const [whatsapp, integration, cutover] = await Promise.all([
    checkWhatsAppReadiness(organization.id),
    getWhatsAppIntegration(organization.id),
    checkMaiaLiveCutoverReadiness(organization.id),
  ]);
  const config = (integration?.configuration || {}) as Record<string, unknown>;
  const active = config.maia_active === true;

  return (
    <main className="admin-page dashboard-v2-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty · Maia</p>
          <h1>Connections</h1>
          <p>Connect the channels Maia uses to receive enquiries, respond, remember context and continue customer workflows.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className={active ? "admin-status live" : cutover.readyForLiveTraffic ? "admin-status live" : "admin-status warning"}>
            {active ? "WhatsApp active" : cutover.readyForLiveTraffic ? "Ready to activate" : "Setup required"}
          </span>
          <Link href="/dashboard/limitless/agentic" className="admin-btn secondary">Back to Maia</Link>
        </div>
      </header>

      <section className="admin-grid two" style={{ marginBottom: 20 }}>
        <article className="admin-metric-card">
          <p>Workspace</p>
          <strong>{organization.name}</strong>
          <span>Tenant-isolated integration settings</span>
        </article>
        <article className="admin-metric-card">
          <p>Runtime</p>
          <strong>Trigger.dev</strong>
          <span>Maia automation and message execution</span>
        </article>
        <article className="admin-metric-card">
          <p>WhatsApp readiness</p>
          <strong>{cutover.readyForLiveTraffic ? "Ready" : "Blocked"}</strong>
          <span>{cutover.checks.filter((check) => !check.ok).length} remaining checks</span>
        </article>
        <article className="admin-metric-card">
          <p>Credential model</p>
          <strong>{whatsapp.credentialSource === "tenant_vault" ? "Tenant Vault" : whatsapp.credentialSource === "legacy_env" ? "Legacy" : "Not set"}</strong>
          <span>Secrets are never rendered back into the dashboard</span>
        </article>
      </section>

      <WhatsAppIntegrationPanel
        organizationName={organization.name || "this workspace"}
        initialReadiness={whatsapp}
        initiallyActive={active}
      />

      <section className="admin-panel" style={{ marginTop: 20 }}>
        <div className="admin-panel-header">
          <div>
            <p className="admin-kicker">How tenant connections work</p>
            <h2>One setup model for every Fluxknight client</h2>
            <p>Limitless Realty is using the same organization-scoped connection system that future Maia tenants will use.</p>
          </div>
        </div>
        <div className="admin-list">
          <div className="admin-list-row"><div><strong>Phone Number ID</strong><span>Identifies the WhatsApp number and maps inbound traffic to this workspace.</span></div><em>workspace</em></div>
          <div className="admin-list-row"><div><strong>Permanent Access Token</strong><span>Stored in the tenant&apos;s protected credential record and never displayed after save.</span></div><em>vault</em></div>
          <div className="admin-list-row"><div><strong>WABA ID</strong><span>Associates the number with the correct WhatsApp Business Account.</span></div><em>workspace</em></div>
          <div className="admin-list-row"><div><strong>Webhook security</strong><span>Managed by the Fluxknight platform rather than exposed to individual tenants.</span></div><em>platform</em></div>
          <div className="admin-list-row"><div><strong>Activation</strong><span>Maia receives live WhatsApp traffic only after all readiness checks pass and the workspace is activated.</span></div><em>{active ? "active" : "gated"}</em></div>
        </div>
      </section>
    </main>
  );
}
