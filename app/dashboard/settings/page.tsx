import { getSupabaseReadiness } from "@/lib/limitless-data";

const settings = [
  ["LIMITLESS_ADMIN_EMAIL", "Admin login email"],
  ["LIMITLESS_ADMIN_PASSWORD", "Admin login password"],
  ["ADMIN_SESSION_SECRET", "Cookie signing secret"],
  ["LIMITLESS_API_KEY", "API key for n8n/backend requests"],
  ["SUPABASE_URL", "Supabase project URL"],
  ["SUPABASE_SECRET_KEY", "Vercel Supabase server key"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase service role key"],
  ["SUPABASE_PUBLISHABLE_KEY", "Vercel Supabase publishable key"],
  ["N8N_BASE_URL", "n8n base URL"],
  ["N8N_EMAIL", "n8n login email"],
  ["N8N_PASSWORD", "n8n login password"],
  ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "Google Drive service account email"],
  ["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "Google Drive service account private key"],
  ["GOOGLE_DRIVE_PROPERTY_FOLDER_ID", "Google Drive parent folder for property images"],
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
          {settings.map(([key, label]) => (
            <div key={key} className="admin-list-row">
              <div>
                <strong>{key}</strong>
                <span>{label}</span>
              </div>
              <em>{process.env[key] ? "set" : "missing"}</em>
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
                <strong>Supabase</strong>
                <span>Set Supabase env vars in Vercel before table checks can run.</span>
              </div>
              <em>pending</em>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
