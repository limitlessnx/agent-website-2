import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getMetaIntegration() {
  const supabase = createAdminClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id,name")
    .eq("slug", "fluxknight")
    .maybeSingle();

  if (!organization) return { organization: null, integration: null };

  const { data: integration } = await supabase
    .from("organization_integrations")
    .select("id,provider,display_name,status,configuration,health,last_checked_at,last_connected_at,updated_at")
    .eq("organization_id", organization.id)
    .eq("provider", "meta")
    .maybeSingle();

  return { organization, integration };
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { organization, integration } = await getMetaIntegration();
  const configured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  const status = integration?.status || "disconnected";
  const config = (integration?.configuration || {}) as Record<string, unknown>;
  const health = (integration?.health || {}) as Record<string, unknown>;
  const success = params.meta === "connected";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Platform Connections</p>
          <h1>Integrations</h1>
          <p>Connect external platforms to Fluxknight without exposing provider credentials in the dashboard.</p>
        </div>
        <Link href="/dashboard/settings" className="admin-btn secondary">Back to Settings</Link>
      </div>

      {success ? (
        <section className="admin-panel" style={{ borderColor: "rgba(34,197,94,.45)" }}>
          <strong>Meta connected successfully.</strong>
          <p style={{ marginTop: 8 }}>Facebook and Instagram analytics can now sync into Flux Social.</p>
        </section>
      ) : null}

      {error ? (
        <section className="admin-panel" style={{ borderColor: "rgba(239,68,68,.45)" }}>
          <strong>Meta connection failed.</strong>
          <p style={{ marginTop: 8 }}>{error}</p>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <p className="admin-kicker">Social Analytics</p>
            <h2>Meta</h2>
            <p>Connect a Facebook Page and its linked Instagram Business account for analytics ingestion.</p>
          </div>
          <span className={status === "connected" ? "admin-status live" : status === "error" ? "admin-status warning" : "admin-status"}>
            {status}
          </span>
        </div>

        <div className="admin-list" style={{ marginBottom: 20 }}>
          <div className="admin-list-row">
            <div><strong>Organization</strong><span>{organization?.name || "Fluxknight"}</span></div>
            <em>{organization ? "ready" : "missing"}</em>
          </div>
          <div className="admin-list-row">
            <div><strong>Meta app configuration</strong><span>App ID and App Secret stay in server environment variables.</span></div>
            <em>{configured ? "ready" : "missing"}</em>
          </div>
          <div className="admin-list-row">
            <div><strong>Facebook Page</strong><span>{String(config.page_name || "Not connected")}</span></div>
            <em>{config.page_id ? "linked" : "pending"}</em>
          </div>
          <div className="admin-list-row">
            <div><strong>Instagram Business</strong><span>{String(config.instagram_username || config.instagram_account_id || "Not connected")}</span></div>
            <em>{config.instagram_account_id ? "linked" : "pending"}</em>
          </div>
          <div className="admin-list-row">
            <div><strong>Connection health</strong><span>{String(health.message || "No connection test yet.")}</span></div>
            <em>{String(health.state || "pending")}</em>
          </div>
          <div className="admin-list-row">
            <div><strong>Last connected</strong><span>{integration?.last_connected_at ? new Date(integration.last_connected_at).toLocaleString() : "Never"}</span></div>
            <em>{integration?.last_checked_at ? "checked" : "not checked"}</em>
          </div>
        </div>

        {configured ? (
          <Link href="/api/integrations/meta/connect" className="admin-btn primary">
            {status === "connected" ? "Reconnect Meta" : "Connect Meta"}
          </Link>
        ) : (
          <p style={{ margin: 0 }}>
            Add <strong>META_APP_ID</strong> and <strong>META_APP_SECRET</strong> to the server environment before connecting.
          </p>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>What Fluxknight stores</h2>
            <p>The dashboard never displays the Meta access token after connection.</p>
          </div>
        </div>
        <div className="admin-list">
          <div className="admin-list-row"><div><strong>Secure credential</strong><span>Stored through the existing integration vault workflow.</span></div><em>protected</em></div>
          <div className="admin-list-row"><div><strong>Page & account IDs</strong><span>Stored as non-secret integration configuration for analytics routing.</span></div><em>stored</em></div>
          <div className="admin-list-row"><div><strong>Analytics</strong><span>Normalized into Flux Social metric tables and learning snapshots.</span></div><em>automatic</em></div>
        </div>
      </section>
    </div>
  );
}
