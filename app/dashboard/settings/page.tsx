import { getSupabaseReadiness } from "@/lib/limitless-data";

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
  const supabase = await getSupabaseReadiness();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Backend</p>
          <h1>Settings</h1>
          <p>Environment variables required for production control.</p>
        </div>
        <span className={supabase.ready ? "admin-status live" : "admin-status warning"}>
          {supabase.ready ? "Database live" : "Database schema pending"}
        </span>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Required Environment Variables</h2>
          <p>Add these in Vercel Project Settings before production use.</p>
        </div>
        <div className="admin-list">
          {settings.map((setting) => (
            <div key={setting.keys.join("|")} className="admin-list-row">
              <div>
                <strong>{setting.display}</strong>
                <span>{setting.label}</span>
              </div>
              <em>{setting.keys.some((key) => process.env[key]) ? "set" : "missing"}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Live Supabase Tables</h2>
          <p>The dashboard requires these tables in the connected Supabase project.</p>
        </div>
        <div className="admin-list">
          {supabase.tables.length ? supabase.tables.map((table) => (
            <div key={table.table} className="admin-list-row">
              <div>
                <strong>{table.table}</strong>
                <span>{table.error || "Ready for live reads and writes."}</span>
              </div>
              <em>{table.ready ? "ready" : "missing"}</em>
            </div>
          )) : (
            <div className="admin-list-row">
              <div>
                <strong>Database</strong>
                <span>Set database env vars in Vercel before table checks can run.</span>
              </div>
              <em>pending</em>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
