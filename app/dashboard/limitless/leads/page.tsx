import {
  createProgressiveLeadAction,
  importProgressiveLeadsAction,
} from "@/app/dashboard/progressive-lead-actions";
import LeadsCrm from "@/components/admin/LeadsCrm";
import styles from "./page.module.css";
import { getCampaignGroups } from "@/lib/campaign-groups";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ imported?: string; skipped?: string; errors?: string; saved?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const [leads, groups] = await Promise.all([
    getCampaignAudienceLeads(1000),
    getCampaignGroups(100),
  ]);
  const hotLeads = leads.filter((lead) => ["hot", "qualified"].includes(String(lead.score || lead.status).toLowerCase())).length;
  const undocumented = leads.filter((lead) => lead.profile_status === "undocumented").length;
  const imported = Number(params.imported || 0);
  const skipped = Number(params.skipped || 0);
  const errors = Number(params.errors || 0);
  const saved = params.saved === "1";

  return (
    <div className="admin-page">
      <header className={styles.hero}>
        <div>
          <span className={styles.kicker}>Limitless Realty</span>
          <h1>Lead CRM</h1>
          <p>Review lead movement, follow-up state, customer intent and campaign readiness from one operating view.</p>
        </div>
        <div className={styles.heroAside}>
          <div><strong>{hotLeads}</strong><span>Hot / qualified</span></div>
          <div><strong>{undocumented}</strong><span>Undocumented</span></div>
        </div>
      </header>

      <nav className={styles.pageActions} aria-label="Lead CRM shortcuts">
        <a href="#lead-control">Review pipeline</a>
        <a href="#lead-tools">Add or import contacts</a>
      </nav>

      {saved ? (
        <section className="admin-panel import-result-panel">
          <div className="admin-panel-header">
            <div><h2>Lead Saved</h2><p>The contact is ready for campaigns and follow-up.</p></div>
            <span className="admin-status live">Saved</span>
          </div>
        </section>
      ) : null}

      {imported || skipped || errors ? (
        <section className="admin-panel import-result-panel">
          <div className="admin-panel-header">
            <div><h2>Import Result</h2><p>{imported} saved or updated, {skipped} skipped, {errors} error(s).</p></div>
            <span className={errors ? "admin-status warning" : "admin-status live"}>{errors ? "Review file" : "Saved"}</span>
          </div>
        </section>
      ) : null}

      <div id="lead-control">
        <LeadsCrm leads={leads} groups={groups} />
      </div>

      <section id="lead-tools" className={styles.toolsGrid}>
        <details className={styles.toolPanel}>
          <summary>Add a contact <span className="admin-status warning">{undocumented} undocumented</span></summary>
          <div className={styles.toolBody}>
            <form action={createProgressiveLeadAction} className="admin-form-grid">
              <input name="name" placeholder="Name" required />
              <input name="phone" placeholder="WhatsApp phone e.g. +234..." required />
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
              <button type="submit">Save contact</button>
            </form>
          </div>
        </details>

        <details className={styles.toolPanel}>
          <summary>Import contacts from a file or phone</summary>
          <div className={styles.toolBody}>
            <form action={importProgressiveLeadsAction} className="admin-import-form">
              <label className="admin-file-field">
                <span>CSV, Excel, or phone contacts (.vcf), up to 1,000 contacts</span>
                <input
                  name="contacts_file"
                  type="file"
                  accept=".csv,.xlsx,.xls,.vcf,text/csv,text/vcard,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  required
                />
              </label>
              <p className="admin-form-help">On phones, export or share your contacts as a .vcf file, then select it here. This keeps the import compatible with iPhone and Android instead of relying on a browser feature that only some devices support.</p>
              <button type="submit">Import contacts</button>
            </form>
          </div>
        </details>
      </section>
    </div>
  );
}
