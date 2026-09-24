import Link from "next/link";
import { getFluxknightOrganization, getMetaCredentials, getMetaIntegration } from "@/lib/meta-integration";
import { saveMetaAppCredentials } from "./actions";

export const dynamic = "force-dynamic";

export default async function SocialIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const organization = await getFluxknightOrganization();
  const integration = await getMetaIntegration(organization.id);
  const credentials = await getMetaCredentials(organization.id);
  const config = (integration?.configuration || {}) as Record<string, unknown>;
  const health = (integration?.health || {}) as Record<string, unknown>;
  const appId = String(credentials?.app_id || config.app_id || "");
  const loginConfigurationId = String(credentials?.login_configuration_id || config.login_configuration_id || "");
  const preferredPageId = String(credentials?.preferred_page_id || config.preferred_page_id || "");
  const preferredInstagramAccount = String(credentials?.preferred_instagram_account || config.preferred_instagram_account || "");
  const configured = Boolean(appId && credentials?.app_secret);
  const status = integration?.status || "disconnected";
  const success = params.meta === "configured" || params.meta === "connected";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Social Integrations</h1>
          <p>Configure and connect the platforms Flux Social uses for publishing, analytics and learning.</p>
        </div>
        <Link href="/dashboard/social" className="admin-btn secondary">Back to Social</Link>
      </header>

      {success ? (
        <section className="admin-panel" style={{ borderColor: "rgba(34,197,94,.45)" }}>
          <strong>{params.meta === "connected" ? "Meta connected successfully." : "Meta app credentials saved securely."}</strong>
          <p style={{ marginTop: 8 }}>
            {params.meta === "connected"
              ? "Facebook and Instagram analytics can now sync into Flux Social."
              : "You can now connect the Facebook Page and linked Instagram Business account."}
          </p>
        </section>
      ) : null}

      {error ? (
        <section className="admin-panel" style={{ borderColor: "rgba(239,68,68,.45)" }}>
          <strong>Meta setup needs attention.</strong>
          <p style={{ marginTop: 8 }}>{error}</p>
        </section>
      ) : null}

      <section className="admin-grid two">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="admin-kicker">Step 1</p>
              <h2>Meta App Credentials</h2>
              <p>Enter the Meta Developer App credentials here. The App Secret is stored in Supabase Vault and is never shown again.</p>
            </div>
            <span className={configured ? "admin-status live" : "admin-status warning"}>{configured ? "configured" : "required"}</span>
          </div>

          <form action={saveMetaAppCredentials} className="admin-form" style={{ display: "grid", gap: 16 }}>
            <label>
              <span>Meta App ID</span>
              <input
                name="appId"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                defaultValue={appId}
                placeholder="Your Meta App ID"
              />
            </label>
            <label>
              <span>Meta App Secret</span>
              <input
                name="appSecret"
                type="password"
                autoComplete="new-password"
                placeholder={configured ? "Enter a new secret to replace the stored one" : "Your Meta App Secret"}
              />
            </label>
            <label>
              <span>Login Configuration ID</span>
              <input
                name="loginConfigurationId"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={loginConfigurationId}
                placeholder="Optional Facebook Login for Business ID"
              />
            </label>
            <label>
              <span>Preferred Facebook Page ID</span>
              <input
                name="preferredPageId"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={preferredPageId}
                placeholder="Only connect this Page when Meta returns multiple"
              />
            </label>
            <label>
              <span>Preferred Instagram account</span>
              <input
                name="preferredInstagramAccount"
                type="text"
                autoComplete="off"
                defaultValue={preferredInstagramAccount}
                placeholder="Instagram username or Business account ID"
              />
            </label>
            <div>
              <button className="admin-btn primary" type="submit">
                {configured ? "Update Meta Credentials" : "Save Meta Credentials"}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="admin-kicker">Step 2</p>
              <h2>Connect Meta Account</h2>
              <p>Authorize the Facebook Page and linked Instagram Business account Flux Social should use.</p>
            </div>
            <span className={status === "connected" ? "admin-status live" : status === "error" ? "admin-status warning" : "admin-status"}>{status}</span>
          </div>

          <div className="admin-list" style={{ marginBottom: 20 }}>
            <div className="admin-list-row"><div><strong>Facebook Page</strong><span>{String(config.page_name || "Not connected")}</span></div><em>{config.page_id ? "linked" : "pending"}</em></div>
            <div className="admin-list-row"><div><strong>Instagram Business</strong><span>{String(config.instagram_username || config.instagram_business_account_id || "Not connected")}</span></div><em>{config.instagram_business_account_id ? "linked" : "pending"}</em></div>
            <div className="admin-list-row"><div><strong>Preferred Page</strong><span>{preferredPageId || preferredInstagramAccount || "Not set"}</span></div><em>{preferredPageId || preferredInstagramAccount ? "targeted" : "auto"}</em></div>
            <div className="admin-list-row"><div><strong>Login Configuration</strong><span>{loginConfigurationId ? "Configured" : "Not configured"}</span></div><em>{loginConfigurationId ? "config_id" : "optional"}</em></div>
            <div className="admin-list-row"><div><strong>Connection health</strong><span>{String(health.message || "No connection test yet.")}</span></div><em>{String(health.state || "pending")}</em></div>
            <div className="admin-list-row"><div><strong>Last connected</strong><span>{integration?.last_connected_at ? new Date(integration.last_connected_at).toLocaleString() : "Never"}</span></div><em>{integration?.last_checked_at ? "checked" : "not checked"}</em></div>
          </div>

          {configured ? (
            <Link href="/api/integrations/meta/connect" className="admin-btn primary">
              {status === "connected" ? "Reconnect Meta" : "Connect Meta"}
            </Link>
          ) : (
            <p style={{ margin: 0 }}>Save the Meta App ID and App Secret first.</p>
          )}
        </section>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Connection model</h2>
            <p>Fluxknight keeps provider setup inside the product while sensitive credentials stay protected behind the server.</p>
          </div>
        </div>
        <div className="admin-list">
          <div className="admin-list-row"><div><strong>App ID</strong><span>Visible configuration used to start Meta OAuth.</span></div><em>dashboard</em></div>
          <div className="admin-list-row"><div><strong>Login Configuration ID</strong><span>Stored for Meta Business Login when that flow is enabled.</span></div><em>dashboard</em></div>
          <div className="admin-list-row"><div><strong>Preferred Page</strong><span>Optional Page or Instagram target used when Meta returns multiple assets.</span></div><em>dashboard</em></div>
          <div className="admin-list-row"><div><strong>App Secret</strong><span>Encrypted in Supabase Vault and never rendered back to the browser.</span></div><em>vault</em></div>
          <div className="admin-list-row"><div><strong>Access token</strong><span>Created after OAuth and stored in the same protected credential record.</span></div><em>vault</em></div>
          <div className="admin-list-row"><div><strong>Analytics</strong><span>Normalized into Flux Social metrics and learning snapshots.</span></div><em>automatic</em></div>
        </div>
      </section>
    </main>
  );
}
