import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import WhatsAppCampaignCenter from "@/components/admin/WhatsAppCampaignCenterV2";
import CampaignReportsRefresh from "@/components/admin/CampaignReportsRefresh";
import { getRealEstateCampaignGroups } from "@/lib/real-estate-campaign-groups";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";
import { getProperties } from "@/lib/limitless-data";
import { getDetailedCampaignReports } from "@/lib/campaign-report-reader";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const { organizationId } = await resolveAdminOrganizationScope();
  const [campaigns, leads, allProperties, groups] = await Promise.all([
    getDetailedCampaignReports(organizationId, 50),
    getCampaignAudienceLeads(organizationId, 5000),
    getProperties(500, organizationId),
    getRealEstateCampaignGroups(organizationId),
  ]);
  const properties = allProperties.filter((property) => property.organization_id === organizationId);

  const recentCampaigns = campaigns.slice(0, 5);
  const eligible = leads.filter((lead) => {
    const status = String(lead.status || "").trim().toLowerCase();
    return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status));
  }).length;
  const undocumented = leads.filter((lead) => lead.profile_status === "undocumented").length;
  const delivered = campaigns.reduce((sum, campaign) => sum + Number(campaign.delivered || 0), 0);
  const failed = campaigns.reduce((sum, campaign) => sum + Number(campaign.failed || 0), 0);
  const attempted = campaigns.reduce((sum, campaign) => sum + Number(campaign.attempted || 0), 0);
  const deliveryRate = attempted ? Math.round((delivered / attempted) * 100) : 0;
  const eligibleRate = leads.length ? Math.round((eligible / leads.length) * 100) : 0;
  const undocumentedRate = leads.length ? Math.round((undocumented / leads.length) * 100) : 0;
  const reportWindowRate = Math.round((Math.min(campaigns.length, 50) / 50) * 100);

  return (
    <div className="admin-page console-page">
      <CampaignReportsRefresh />
      <section className="console-titlebar">
        <div>
          <p className="admin-kicker">Limitless Realty / Messaging Operations</p>
          <h1>WhatsApp Campaign Center</h1>
          <p>Build audiences, select the correct WhatsApp route, monitor delivery, and inspect provider outcomes from one operating console.</p>
        </div>
        <div className="console-status-stack"><span className="console-status-pill">TENANT-SCOPED REPORTS</span><small>Latest 50 stored reports · dashboard refreshes every 5s</small></div>
      </section>

      <section className="console-kpi-grid">
        <article><span>CAMPAIGN-ELIGIBLE LEADS</span><strong>{eligible}</strong><i style={{ "--meter": `${eligibleRate}%` } as React.CSSProperties} /></article>
        <article><span>UNDOCUMENTED LEADS</span><strong>{undocumented}</strong><i style={{ "--meter": `${undocumentedRate}%` } as React.CSSProperties} /></article>
        <article><span>REPORTS IN LATEST 50</span><strong>{campaigns.length}</strong><i style={{ "--meter": `${reportWindowRate}%` } as React.CSSProperties} /></article>
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
