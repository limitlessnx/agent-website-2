import {
  createProgressiveLeadAction,
  importProgressiveLeadsAction,
} from "@/app/dashboard/progressive-lead-actions";
import LeadsCrm from "@/components/admin/LeadsCrm";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ imported?: string; skipped?: string; errors?: string; saved?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const leads = await getCampaignAudienceLeads(1000);
  const hotLeads = leads.filter((lead) => ["hot", "qualified"].includes(String(lead.score || lead.status).toLowerCase())).length;
  const undocumented = leads.filter((lead) => lead.profile_status === "undocumented").length;
  const imported = Number(params.imported || 0);
  const skipped = Number(params.skipped || 0);
  const errors = Number(params.errors || 0);
  const saved = params.saved === "1";

  return (
    <div className="admin-page">
      <section className="admin-hero-panel leads-hero-panel">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Lead CRM</h1>
          <p>
            A lead becomes valid with a name and WhatsApp number. Email and other details remain optional,
            and Maia or staff can progressively complete the profile later.
          </p>
          <div className="admin-hero-actions">
            <a href="#lead-control">Review pipeline</a>
            <a href="#bulk-import">Import contacts</a>
          </div>
        </div>
        <div className="admin-launch-score">
          <span>{hotLeads}</span>
          <p>Hot leads</p>
        </div>
      </section>

      {saved ? (
        <section className="admin-panel import-result-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Lead Saved</h2>
              <p>The contact is immediately eligible for general and manually selected campaigns.</p>
            </div>
            <span className="admin-status live">Saved</span>
          </div>
        </section>
      ) : null}

      {imported || skipped || errors ? (
        <section className="admin-panel import-result-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Import Result</h2>
              <p>{imported} saved or updated, {skipped} skipped, {errors} error(s).</p>
            </div>
            <span className={errors ? "admin-status warning" : "admin-status live"}>{errors ? "Review file" : "Saved"}</span>
          </div>
        </section>
      ) : null}

      <section className="admin-panel lead-capture-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Quick Lead Capture</h2>
            <p>Only name and phone are required. Email and every other field can be completed later.</p>
          </div>
          <span className="admin-status warning">{undocumented} undocumented</span>
        </div>
        <form action={createProgressiveLeadAction} className="admin-form-grid">
          <input name="name" placeholder="Name" required />
          <input name="phone" placeholder="WhatsApp phone e.g. 234..." required />
          <input name="email" type="email" placeholder="Email (optional)" />
          <input name="budget" placeholder="Budget (optional)" />
          <input name="location_preference" placeholder="State or location (optional)" />
          <input name="property_type" placeholder="Property type (optional)" />
          <input name="property_interest" placeholder="Interested property (optional)" />
          <input name="purpose" placeholder="Interest or purpose (optional)" />
          <select name="status" defaultValue="new">
            <option value="new">new</option>
            <option value="in_conversation">in conversation</option>
            <option value="qualified">qualified</option>
            <option value="cold">cold</option>
            <option value="opted_out">opted out</option>
          </select>
          <select name="score" defaultValue="">
            <option value="">unscored</option>
            <option value="cold">cold</option>
            <option value="warm">warm</option>
            <option value="hot">hot</option>
          </select>
          <button type="submit">Save lead</button>
        </form>
      </section>

      <section id="bulk-import" className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Bulk Contact Import</h2>
            <p>Upload up to 1,000 CSV or Excel contacts. Name, phone, and email columns are recognised automatically.</p>
          </div>
        </div>
        <form action={importProgressiveLeadsAction} className="admin-import-form">
          <label className="admin-file-field">
            <span>Contact file</span>
            <input name="contacts_file" type="file" accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" required />
          </label>
          <button type="submit">Import contacts</button>
        </form>
      </section>

      <div id="lead-control">
        <LeadsCrm leads={leads} />
      </div>
    </div>
  );
}
