import { getCampaignReports } from "@/lib/limitless-data";

export default async function CampaignsPage() {
  const campaigns = await getCampaignReports(50);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Campaigns</h1>
          <p>Review WhatsApp broadcast activity and delivery context.</p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Recent Campaign Reports</h2>
          <p>Telegram remains the send/approval interface for now; this page gives central visibility.</p>
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
                  <td>{campaign.created_at ? new Date(campaign.created_at).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
