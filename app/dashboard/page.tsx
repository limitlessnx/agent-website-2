import MetricCard from "@/components/admin/MetricCard";
import { automationProjects, getCampaignReports, getLeads, getN8nStatus, getProperties, isSupabaseConfigured } from "@/lib/limitless-data";

export default async function DashboardPage() {
  const [leads, properties, campaigns, n8n] = await Promise.all([
    getLeads(100),
    getProperties(100),
    getCampaignReports(20),
    getN8nStatus(),
  ]);
  const hotLeads = leads.filter((lead) => ["hot", "qualified"].includes(String(lead.score || lead.status).toLowerCase())).length;
  const missingImages = properties.filter((property) => !property.drive_photos_link).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Control Center</p>
          <h1>Limitless Realty Backend</h1>
          <p>Manage Maia, leads, properties, campaigns, follow-ups, and every automation project from one place.</p>
        </div>
        <span className={isSupabaseConfigured() ? "admin-status live" : "admin-status warning"}>
          {isSupabaseConfigured() ? "Supabase connected" : "Using fallback data"}
        </span>
      </div>

      <div className="admin-metric-grid">
        <MetricCard label="Total leads" value={leads.length} detail={`${hotLeads} hot/qualified`} />
        <MetricCard label="Properties" value={properties.length} detail={`${missingImages} missing images`} />
        <MetricCard label="Campaign reports" value={campaigns.length} detail="WhatsApp delivery context" />
        <MetricCard label="Active n8n workflows" value={n8n.activeWorkflows} detail={n8n.configured ? "Live n8n check" : "n8n env not set"} />
      </div>

      <div className="admin-grid two">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Automation Projects</h2>
            <p>Limitless now, reusable for future client systems.</p>
          </div>
          <div className="admin-list">
            {automationProjects.map((project) => (
              <div key={project.id} className="admin-list-row">
                <div>
                  <strong>{project.name}</strong>
                  <span>{project.description}</span>
                </div>
                <em>{project.status}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Launch Checks</h2>
            <p>Items to keep clean before client demos.</p>
          </div>
          <div className="admin-checklist">
            <span>WhatsApp campaigns use templates outside 24h</span>
            <span>Follow-ups run daily, not hourly</span>
            <span>Viewing reminders are inactive</span>
            <span>{missingImages ? `${missingImages} properties still need image links` : "Property images are complete"}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
