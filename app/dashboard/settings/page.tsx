import Link from "next/link";
import { Database, KeyRound, PlugZap, Settings2, Workflow } from "@/components/admin/ServerIcons";
import { getSupabaseReadiness } from "@/lib/limitless-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import WorkflowRegistryClient from "@/app/dashboard/automations/WorkflowRegistryClient";

const settings = [
  { keys: ["LIMITLESS_ADMIN_EMAIL"], label: "Admin login email", display: "ADMIN_EMAIL" },
  { keys: ["LIMITLESS_ADMIN_PASSWORD"], label: "Admin login password", display: "ADMIN_PASSWORD" },
  { keys: ["ADMIN_SESSION_SECRET"], label: "Cookie signing secret", display: "SESSION_SECRET" },
  { keys: ["LIMITLESS_API_KEY"], label: "API key for backend requests", display: "BACKEND_API_KEY" },
  { keys: ["LIMITLESS_SUPABASE_URL", "SUPABASE_URL"], label: "Database project URL", display: "DATABASE_URL" },
  {
    keys: ["LIMITLESS_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
    label: "Database server key",
    display: "DATABASE_SERVER_KEY",
  },
  { keys: ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"], label: "Database public key", display: "DATABASE_PUBLIC_KEY" },
  { keys: ["N8N_BASE_URL"], label: "Automation engine base URL", display: "AUTOMATION_ENGINE_URL" },
  { keys: ["N8N_EMAIL"], label: "Automation engine login email", display: "AUTOMATION_ENGINE_EMAIL" },
  { keys: ["N8N_PASSWORD"], label: "Automation engine login password", display: "AUTOMATION_ENGINE_PASSWORD" },
  { keys: ["GOOGLE_SERVICE_ACCOUNT_EMAIL"], label: "Media storage service account email", display: "MEDIA_STORAGE_EMAIL" },
  { keys: ["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"], label: "Media storage service account private key", display: "MEDIA_STORAGE_PRIVATE_KEY" },
  { keys: ["GOOGLE_DRIVE_PROPERTY_FOLDER_ID"], label: "Media storage folder for property images", display: "MEDIA_STORAGE_FOLDER_ID" },
];

export default async function SettingsPage() {
  const [supabase, registry] = await Promise.all([
    getSupabaseReadiness(),
    getWorkflowRegistrySummary().catch(() => ({
      configured: false,
      workflows: [],
      runs: [],
      active: 0,
      paused: 0,
      failures: 0,
      successRate: 0,
    })),
  ]);

  const configuredSettings = settings.filter((setting) => setting.keys.some((key) => process.env[key])).length;

  return (
    <main className="admin-page dashboard-v2-page settings-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Platform Control</p>
          <h1>Settings</h1>
          <p>Manage connections, workflow mapping, environment readiness and database visibility without changing the underlying platform behavior.</p>
        </div>
        <span className={supabase.ready ? "admin-status live" : "admin-status warning"}>
          {supabase.ready ? "Database live" : "Database schema pending"}
        </span>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Settings2 size={15} /> Environment</p><strong>{configuredSettings}/{settings.length}</strong><span>Required values currently set</span></article>
        <article className="admin-metric-card"><p><Workflow size={15} /> Workflows</p><strong>{registry.workflows.length}</strong><span>{registry.active} active · {registry.paused} paused</span></article>
        <article className="admin-metric-card"><p><Database size={15} /> Database tables</p><strong>{supabase.tables.filter((table) => table.ready).length}</strong><span>{supabase.tables.length} tracked readiness checks</span></article>
        <article className="admin-metric-card"><p><PlugZap size={15} /> Connections</p><strong>Manage</strong><span>Workspace and platform integrations</span></article>
      </div>

      <div className="settings-layout">
        <aside className="settings-nav admin-panel" aria-label="Settings sections">
          <span className="admin-kicker">SETTINGS</span>
          <a href="#integrations"><PlugZap size={15} /> Integrations</a>
          <a href="#automation"><Workflow size={15} /> Automation</a>
          <a href="#environment"><KeyRound size={15} /> Environment</a>
          <a href="#database"><Database size={15} /> Database</a>
        </aside>

        <div className="settings-content">
          <section className="admin-panel" id="integrations">
            <div className="admin-panel-header">
              <div><h2>Platform Integrations</h2><p>Connect Meta and other platform services from the dedicated integrations workspace.</p></div>
              <Link href="/dashboard/settings/integrations" className="admin-button primary-button">Open integrations</Link>
            </div>
          </section>

          <section className="admin-panel" id="automation">
            <div className="admin-panel-header">
              <div><h2>Automation Engine & Workflow Mapping</h2><p>Map Fluxknight workflows to their real automation IDs, manage state and retry failed runs.</p></div>
              <Workflow size={18} />
            </div>
            <p>Workflow 3 currently expects the key <strong>crm_follow_up_v3</strong> mapped to external workflow ID <strong>n153Nrwf90vI1SJ2</strong>.</p>
          </section>

          <WorkflowRegistryClient
            initialWorkflows={registry.workflows}
            initialRuns={registry.runs}
            configured={registry.configured}
          />

          <section className="admin-panel" id="environment">
            <div className="admin-panel-header">
              <div><h2>Environment Readiness</h2><p>Presence checks only. Secret values are never rendered into the dashboard.</p></div>
              <KeyRound size={18} />
            </div>
            <div className="admin-list">
              {settings.map((setting) => {
                const ready = setting.keys.some((key) => process.env[key]);
                return (
                  <div key={setting.keys.join("|")} className="admin-list-row">
                    <div><strong>{setting.display}</strong><span>{setting.label}</span></div>
                    <em className={ready ? "good" : "bad"}>{ready ? "set" : "missing"}</em>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="admin-panel" id="database">
            <div className="admin-panel-header">
              <div><h2>Live Supabase Tables</h2><p>Readiness of tables required by the current dashboard and runtime.</p></div>
              <Database size={18} />
            </div>
            <div className="admin-list">
              {supabase.tables.length ? supabase.tables.map((table) => (
                <div key={table.table} className="admin-list-row">
                  <div><strong>{table.table}</strong><span>{table.error || "Ready for live reads and writes."}</span></div>
                  <em className={table.ready ? "good" : "bad"}>{table.ready ? "ready" : "missing"}</em>
                </div>
              )) : (
                <div className="admin-list-row">
                  <div><strong>Database</strong><span>Set database environment values in Vercel before table checks can run.</span></div>
                  <em className="muted">pending</em>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
