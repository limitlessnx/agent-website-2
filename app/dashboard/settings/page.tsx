import { isSupabaseConfigured } from "@/lib/limitless-data";

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
];

export default function SettingsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Backend</p>
          <h1>Settings</h1>
          <p>Environment variables required for production control.</p>
        </div>
        <span className={isSupabaseConfigured() ? "admin-status live" : "admin-status warning"}>
          {isSupabaseConfigured() ? "Database connected" : "Database pending"}
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
    </div>
  );
}
