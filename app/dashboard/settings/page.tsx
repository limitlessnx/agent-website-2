import Link from "next/link";
import { Database, Settings2, ShieldCheck, Workflow } from "@/components/admin/ServerIcons";
import { getSupabaseReadiness } from "@/lib/limitless-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import WorkflowRegistryClient from "@/app/dashboard/automations/WorkflowRegistryClient";
import styles from "../PlatformControl.module.css";

const settings = [
  { keys: ["LIMITLESS_ADMIN_EMAIL"], label: "Admin login email", display: "ADMIN_EMAIL" },
  { keys: ["LIMITLESS_ADMIN_PASSWORD"], label: "Admin login password", display: "ADMIN_PASSWORD" },
  { keys: ["ADMIN_SESSION_SECRET"], label: "Cookie signing secret", display: "SESSION_SECRET" },
  { keys: ["LIMITLESS_API_KEY"], label: "API key for backend requests", display: "BACKEND_API_KEY" },
  { keys: ["LIMITLESS_SUPABASE_URL", "SUPABASE_URL"], label: "Database project URL", display: "DATABASE_URL" },
  { keys: ["LIMITLESS_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"], label: "Database server key", display: "DATABASE_SERVER_KEY" },
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
    getWorkflowRegistrySummary().catch(() => ({ configured: false, workflows: [], runs: [], active: 0, paused: 0, failures: 0, successRate: 0 })),
  ]);
  const configuredSettings = settings.filter((setting) => setting.keys.some((key) => process.env[key])).length;
  const missingSettings = settings.length - configuredSettings;
  const readyTables = supabase.tables.filter((table) => table.ready).length;

  return (
    <main className={`${styles.page} admin-page`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}><p className="admin-kicker">Platform control</p><h1>Settings</h1><p>Review platform readiness, environment state, integrations and workflow mappings without duplicating the operational dashboards that already own day-to-day work.</p></div>
        <span className={`${styles.heroStatus} ${supabase.ready && !missingSettings ? styles.good : styles.warn}`}><ShieldCheck size={14} /> {supabase.ready ? "Database connected" : "Database setup pending"}</span>
      </header>

      <section className={styles.metrics} aria-label="Platform settings summary">
        <article className={styles.metric}><span className={styles.metricLabel}><Settings2 size={14} /> Environment</span><strong>{configuredSettings}/{settings.length}</strong><small>Required variables currently present</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><Database size={14} /> Tables ready</span><strong>{readyTables}/{supabase.tables.length}</strong><small>Supabase checks reporting ready</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><Workflow size={14} /> Active workflows</span><strong>{registry.active}</strong><small>{registry.paused} paused · {registry.failures} failures</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><ShieldCheck size={14} /> Missing config</span><strong>{missingSettings}</strong><small>Environment items still absent</small></article>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Platform integrations</h2><p>Connect Meta and supported external services from the dedicated integration control surface.</p></div><Link href="/dashboard/settings/integrations" className={styles.inlineLink}>Open integrations</Link></div>
          <p className={styles.note}>Provider credentials remain server-side. This page reports configuration state rather than exposing secret values.</p>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Automation operations</h2><p>Operational monitoring lives in Automations; registry mapping remains available below.</p></div><Link href="/dashboard/workflows" className={styles.inlineLink}>Open automations</Link></div>
          <p className={styles.note}>Workflow 3 currently expects key <strong>crm_follow_up_v3</strong> mapped to external workflow ID <strong>n153Nrwf90vI1SJ2</strong>.</p>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Required environment variables</h2><p>Presence only is shown here. Secret values are never rendered back into the dashboard.</p></div><Settings2 size={17} /></div>
        <div className={styles.list}>{settings.map((setting) => { const present = setting.keys.some((key) => process.env[key]); return <div key={setting.keys.join("|")} className={styles.row}><div className={styles.rowMain}><strong>{setting.display}</strong><span>{setting.label}</span></div><em className={`${styles.status} ${present ? styles.good : styles.warn}`}>{present ? "Set" : "Missing"}</em></div>; })}</div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Database readiness</h2><p>Current table checks from the connected Supabase project.</p></div><Database size={17} /></div>
        <div className={styles.list}>
          {supabase.tables.length ? supabase.tables.map((table) => <div key={table.table} className={styles.row}><div className={styles.rowMain}><strong>{table.table}</strong><span>{table.error || "Ready for live reads and writes."}</span></div><em className={`${styles.status} ${table.ready ? styles.good : styles.warn}`}>{table.ready ? "Ready" : "Missing"}</em></div>) : <p className={styles.empty}>Database environment variables are not available, so table readiness cannot be verified.</p>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Workflow registry mapping</h2><p>Preserved admin controls for mapping Fluxknight workflow keys to their real automation workflows.</p></div><Workflow size={17} /></div>
        <div style={{ padding: 18 }}><WorkflowRegistryClient initialWorkflows={registry.workflows} initialRuns={registry.runs} configured={registry.configured} /></div>
      </section>
    </main>
  );
}
