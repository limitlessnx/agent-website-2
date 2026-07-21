import { createLeadAction } from "@/app/dashboard/actions";
import { getLeads } from "@/lib/limitless-data";

export default async function LeadsPage() {
  const leads = await getLeads(100);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Leads</h1>
          <p>View, add, and qualify WhatsApp and Telegram leads.</p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Add Lead</h2>
          <p>Manual lead entry for phone calls, referrals, and imported contacts.</p>
        </div>
        <form action={createLeadAction} className="admin-form-grid">
          <input name="name" placeholder="Name" required />
          <input name="phone" placeholder="WhatsApp phone e.g. 234..." required />
          <input name="budget" placeholder="Budget" />
          <input name="location_preference" placeholder="Location preference" />
          <input name="property_type" placeholder="Property type" />
          <input name="purpose" placeholder="Purpose" />
          <select name="status" defaultValue="new">
            <option value="new">new</option>
            <option value="in_conversation">in conversation</option>
            <option value="qualified">qualified</option>
            <option value="cold">cold</option>
          </select>
          <select name="score" defaultValue="unscored">
            <option value="unscored">unscored</option>
            <option value="cold">cold</option>
            <option value="warm">warm</option>
            <option value="hot">hot</option>
          </select>
          <button type="submit">Save lead</button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Lead Pipeline</h2>
          <p>{leads.length} lead records loaded.</p>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Status</th><th>Score</th><th>Budget</th><th>Location</th><th>Follow-up</th></tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.name || "Unknown"}</td>
                  <td>{lead.phone}</td>
                  <td>{lead.status}</td>
                  <td>{lead.score || "unscored"}</td>
                  <td>{lead.budget || "-"}</td>
                  <td>{lead.location_preference || "-"}</td>
                  <td>{lead.follow_up_stage ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
