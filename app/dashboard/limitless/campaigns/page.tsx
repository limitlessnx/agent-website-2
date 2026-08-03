import WhatsAppCampaignCenter from "@/components/admin/WhatsAppCampaignCenter";
import { getCampaignGroups } from "@/lib/campaign-groups";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";
import { getProperties } from "@/lib/limitless-data";
import { getDetailedCampaignReports } from "@/lib/campaign-report-reader";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaigns, leads, properties, groups] = await Promise.all([
    getDetailedCampaignReports(50),
    getCampaignAudienceLeads(5000),
    getProperties(500),
    getCampaignGroups(100),
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
            Send campaigns directly from Fluxknight through Maia&apos;s WhatsApp delivery engine. Target all
            leads, manually selected contacts, or audiences filtered by state, interest, property, and budget.
          </p>
        </div>
        <div className="admin-launch-score"><span>{eligible}</span><p>Campaign-ready leads</p></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Direct WhatsApp Campaign</h2><p>Every send now carries duplicate protection and truthful provider delivery state.</p></div>
          <span className="admin-status live">{undocumented} undocumented</span>
        </div>
        <WhatsAppCampaignCenter leads={leads} properties={properties} groups={groups} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Recent Campaign Reports</h2><p>Provider submission, delivery confirmations, delivery blocks, and failures.</p></div></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Campaign</th><th>Type</th><th>Template</th><th>Status</th><th>Attempted</th><th>Sent</th><th>Delivered</th><th>Pending</th><th>Failed</th><th>Skipped</th><th>Delivery note</th><th>Date</th></tr></thead>
            <tbody>
              {campaigns.length ? campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>{campaign.campaign_topic}</td>
                  <td>{campaign.campaign_type.replaceAll("_", " ")}</td>
                  <td>{campaign.template_name || "-"}</td>
                  <td>{campaign.status.replaceAll("_", " ")}</td>
                  <td>{campaign.attempted}</td>
                  <td>{campaign.accepted}</td>
                  <td>{campaign.delivered}</td>
                  <td>{campaign.pending_delivery}</td>
                  <td>{campaign.failed}</td>
                  <td>{campaign.skipped}</td>
                  <td>{campaign.final_status_note || "-"}</td>
                  <td>{campaign.created_at ? new Date(campaign.created_at).toLocaleString("en-NG") : "-"}</td>
                </tr>
              )) : <tr><td colSpan={12}>No saved campaign reports yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
