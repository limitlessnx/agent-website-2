import { getSupabaseReadiness } from "@/lib/limitless-data";

const settings = [
  { keys: ["LIMITLESS_ADMIN_EMAIL"], label: "Admin login email" },
  { keys: ["LIMITLESS_ADMIN_PASSWORD"], label: "Admin login password" },
  { keys: ["ADMIN_SESSION_SECRET"], label: "Cookie signing secret" },
  { keys: ["LIMITLESS_API_KEY"], label: "API key for n8n/backend requests" },
  { keys: ["LIMITLESS_SUPABASE_URL", "SUPABASE_URL"], label: "Supabase project URL" },
  {
    keys: ["LIMITLESS_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
    label: "Supabase server key",
  },
  { keys: ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"], label: "Supabase public/anon key" },
  { keys: ["N8N_BASE_URL"], label: "n8n base URL" },
  { keys: ["N8N_EMAIL"], label: "n8n login email" },
  { keys: ["N8N_PASSWORD"], label: "n8n login password" },
  { keys: ["GOOGLE_SERVICE_ACCOUNT_EMAIL"], label: "Google Drive service account email" },
  { keys: ["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"], label: "Google Drive service account private key" },
  { keys: ["GOOGLE_DRIVE_PROPERTY_FOLDER_ID"], label: "Google Drive parent folder for property images" },
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
                <strong>{setting.keys.join(" or ")}</strong>
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
