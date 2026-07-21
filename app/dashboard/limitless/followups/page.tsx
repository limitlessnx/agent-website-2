import { getLeads } from "@/lib/limitless-data";

const stages = [
  { stage: 0, label: "24 hours", description: "First reminder after client contact." },
  { stage: 1, label: "3 days", description: "Second reminder after previous successful follow-up." },
  { stage: 2, label: "7 days", description: "Third reminder after previous successful follow-up." },
  { stage: 3, label: "14 days", description: "Final reminder before cooling the lead." },
];

export default async function FollowupsPage() {
  const leads = await getLeads(200);
  const active = leads.filter((lead) => Number(lead.follow_up_stage || 0) < 4 && !["cold", "closed", "converted"].includes(String(lead.status).toLowerCase()));

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Follow-ups</h1>
          <p>Auto WhatsApp follow-ups are daily and per-lead: 24h, 3d, 7d, 14d.</p>
        </div>
        <span className="admin-status live">Daily 8AM</span>
      </div>

      <div className="admin-grid four">
        {stages.map((item) => (
          <section key={item.stage} className="admin-panel compact">
            <h2>{item.label}</h2>
            <p>{item.description}</p>
            <strong>{active.filter((lead) => Number(lead.follow_up_stage || 0) === item.stage).length}</strong>
          </section>
        ))}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Active Follow-up Leads</h2>
          <p>{active.length} leads still inside the sequence.</p>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Stage</th><th>Last follow-up</th><th>Status</th></tr></thead>
            <tbody>
              {active.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.name}</td>
                  <td>{lead.phone}</td>
                  <td>{lead.follow_up_stage ?? 0}</td>
                  <td>{lead.last_follow_up_at ? new Date(lead.last_follow_up_at).toLocaleString() : "-"}</td>
                  <td>{lead.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
