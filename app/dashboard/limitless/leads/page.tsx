import { createLeadAction } from "@/app/dashboard/actions";
import LeadsCrm from "@/components/admin/LeadsCrm";
import { getLeads } from "@/lib/limitless-data";

export default async function LeadsPage() {
  const leads = await getLeads(100);
  const hotLeads = leads.filter((lead) => ["hot", "qualified"].includes(String(lead.score || lead.status).toLowerCase())).length;
  const missingPhone = leads.filter((lead) => !lead.phone).length;

  return (
    <div className="admin-page">
      <section className="admin-hero-panel leads-hero-panel">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Lead CRM</h1>
          <p>
            View, search, qualify, and act on WhatsApp and Telegram leads. Maia depends on this page
            for clean follow-up, campaign targeting, and human handoff.
          </p>
          <div className="admin-hero-actions">
            <a href="#lead-control">Review pipeline</a>
            <a href="/dashboard/limitless/campaigns">Create campaign</a>
          </div>
        </div>
        <div className="admin-launch-score">
          <span>{hotLeads}</span>
          <p>Hot leads</p>
        </div>
      </section>

      <section className="admin-panel lead-capture-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Quick Lead Capture</h2>
            <p>Manual entry for calls, referrals, events, and imported contacts.</p>
          </div>
          {missingPhone ? <span className="admin-status warning">{missingPhone} missing phone</span> : <span className="admin-status live">Phones clean</span>}
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

      <div id="lead-control">
        <LeadsCrm leads={leads} />
      </div>
    </div>
  );
}
