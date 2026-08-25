import WhatsAppCampaignCenter from "@/components/admin/WhatsAppCampaignCenterV2";
import CampaignReportsRefresh from "@/components/admin/CampaignReportsRefresh";
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

  const recentCampaigns = campaigns.slice(0, 5);
  const eligible = leads.filter((lead) => lead.phone && lead.campaign_eligible !== false).length;
  const undocumented = leads.filter((lead) => lead.profile_status === "undocumented").length;
  const delivered = campaigns.reduce((sum, campaign) => sum + Number(campaign.delivered || 0), 0);
  const failed = campaigns.reduce((sum, campaign) => sum + Number(campaign.failed || 0), 0);
  const attempted = campaigns.reduce((sum, campaign) => sum + Number(campaign.attempted || 0), 0);
  const deliveryRate = attempted ? Math.round((delivered / attempted) * 100) : 0;

  return (
    <div className="admin-page console-page">
      <CampaignReportsRefresh />
      <section className="console-titlebar">
        <div>
          <p className="admin-kicker">Limitless Realty / Messaging Operations</p>
          <h1>WhatsApp Campaign Center</h1>
          <p>Build audiences, select the correct WhatsApp route, monitor delivery, and inspect provider outcomes from one operating console.</p>
        </div>
        <div className="console-status-stack"><span className="console-status-pill">LIVE WORKSPACE</span><small>Maia delivery engine · reports refresh every 5s</small></div>
      </section>

      <section className="console-kpi-grid">
        <article><span>READY LEADS</span><strong>{eligible}</strong><i style={{ "--meter": `${Math.min(100, eligible ? 82 : 0)}%` } as React.CSSProperties} /></article>
        <article><span>UNDOCUMENTED</span><strong>{undocumented}</strong><i style={{ "--meter": `${Math.min(100, eligible ? Math.round((undocumented / eligible) * 100) : 0)}%` } as React.CSSProperties} /></article>
        <article><span>CAMPAIGNS</span><strong>{campaigns.length}</strong><i style={{ "--meter": `${Math.min(100, campaigns.length * 8)}%` } as React.CSSProperties} /></article>
        <article><span>DELIVERY RATE</span><strong>{deliveryRate}%</strong><i style={{ "--meter": `${deliveryRate}%` } as React.CSSProperties} /></article>
      </section>

      <WhatsAppCampaignCenter leads={leads} properties={properties} groups={groups} />

      <section className="console-panel campaign-report-panel">
        <header className="console-panel-head"><div><span>DELIVERY LOG</span><h2>Recent campaign reports</h2></div><small>Showing latest {recentCampaigns.length} · {failed} failed deliveries recorded · live refresh</small></header>
        <div className="admin-table-wrap"><table className="admin-table console-table"><thead><tr><th>Campaign</th><th>Status</th><th>Attempted</th><th>Delivered</th><th>Pending</th><th>Failed</th><th>Skipped</th><th>Date</th></tr></thead><tbody>{recentCampaigns.length ? recentCampaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.campaign_topic}</strong><small>{campaign.template_name || campaign.campaign_type.replaceAll("_", " ")}</small></td><td><span className={`console-table-status ${campaign.failed ? "danger" : campaign.delivered ? "success" : "pending"}`}>{campaign.status.replaceAll("_", " ")}</span></td><td>{campaign.attempted}</td><td>{campaign.delivered}</td><td>{campaign.pending_delivery}</td><td>{campaign.failed}</td><td>{campaign.skipped}</td><td>{campaign.created_at ? new Date(campaign.created_at).toLocaleString("en-NG") : "-"}</td></tr>) : <tr><td colSpan={8}>No saved campaign reports yet.</td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}
