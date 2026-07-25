import WhatsAppCampaignCenter from "@/components/admin/WhatsAppCampaignCenter";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";
import { getCampaignReports, getProperties } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaigns, leads, properties] = await Promise.all([
    getCampaignReports(50),
    getCampaignAudienceLeads(5000),
    getProperties(500),
  ]);

  const eligible = leads.filter((lead) => lead.phone && lead.campaign_eligible !== false).length;
  const undocumented = leads.filter((lead) => lead.profile_status === "undocumented").length;

  return (
    <div className="admin-page">
      <section className="admin-hero-panel">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>WhatsApp Campaign Center</h1>
          <p>
            Send campaigns directly from Fluxknight through Maia&apos;s WhatsApp client agent. Target all
            leads, manually selected contacts, or audiences filtered by state, interest, property, and budget.
          </p>
        </div>
        <div className="admin-launch-score">
          <span>{eligible}</span>
          <p>Campaign-ready leads</p>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Direct WhatsApp Campaign</h2>
            <p>
              Telegram is no longer required as the dashboard trigger. Undocumented leads remain eligible
              when they have a valid name and phone number.
            </p>
          </div>
          <span className="admin-status live">{undocumented} undocumented</span>
        </div>
        <WhatsAppCampaignCenter leads={leads} properties={properties} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Recent Campaign Reports</h2>
            <p>Delivery summaries saved by dashboard and existing WhatsApp campaign executions.</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Campaign</th><th>Attempted</th><th>Accepted</th><th>Failed</th><th>Skipped</th><th>Date</th></tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>{campaign.campaign_topic}</td>
                  <td>{campaign.attempted}</td>
                  <td>{campaign.accepted}</td>
                  <td>{campaign.failed}</td>
                  <td>{campaign.skipped}</td>
                  <td>{campaign.created_at ? new Date(campaign.created_at).toLocaleString("en-NG") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
