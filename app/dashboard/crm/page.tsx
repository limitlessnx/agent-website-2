import { Building2, MessageSquareText, Target, Users } from "@/components/admin/ServerIcons";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const { supabase, organizationId } = await requireTenant();
  const [{ data: customers }, { data: leads }] = await Promise.all([
    supabase.from("crm_customers").select("id,display_name,email,phone,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("crm_leads").select("id,title,status,stage,source,created_at,customer_id").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
  ]);

  const customerRows = customers || [];
  const leadRows = leads || [];
  const activeLeads = leadRows.filter((lead) => !["closed", "lost", "converted"].includes(String(lead.status || "").toLowerCase()));
  const qualified = leadRows.filter((lead) => ["qualified", "hot", "inspection", "proposal"].some((state) => String(lead.stage || lead.status || "").toLowerCase().includes(state)));

  return (
    <main className="admin-page dashboard-v2-page crm-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">CRM</p>
          <h1>Customers & Leads</h1>
          <p>Track customer records and lead movement inside the authenticated organisation. Existing RLS and tenant scoping remain unchanged.</p>
        </div>
        <span className="admin-status live">Tenant scoped</span>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Users size={15} /> Customers</p><strong>{customerRows.length}</strong><span>Visible in this workspace</span></article>
        <article className="admin-metric-card"><p><Target size={15} /> Active leads</p><strong>{activeLeads.length}</strong><span>Still moving through pipeline</span></article>
        <article className="admin-metric-card"><p><MessageSquareText size={15} /> Qualified</p><strong>{qualified.length}</strong><span>Higher-intent lead states</span></article>
        <article className="admin-metric-card"><p><Building2 size={15} /> Workspace</p><strong>1</strong><span>Current organisation scope</span></article>
      </div>

      <section className="crm-split">
        <article className="admin-panel">
          <div className="admin-panel-header">
            <div><h2>Lead Pipeline</h2><p>Latest lead records with stage, status and acquisition source.</p></div>
            <Target size={18} />
          </div>
          <div className="admin-list">
            {leadRows.map((lead) => (
              <div key={lead.id} className="admin-list-row">
                <div>
                  <strong>{lead.title || "Untitled lead"}</strong>
                  <span>{lead.source || "Unknown source"} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(lead.created_at))}</span>
                </div>
                <em className={["closed", "converted"].includes(String(lead.status || "").toLowerCase()) ? "good" : "muted"}>{lead.stage || lead.status || "new"}</em>
              </div>
            ))}
            {!leadRows.length ? <div className="admin-empty-state"><div><Target size={20} /><p>No leads yet.</p></div></div> : null}
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel-header">
            <div><h2>Customers</h2><p>Customer identity and current account status.</p></div>
            <Users size={18} />
          </div>
          <div className="admin-list">
            {customerRows.map((customer) => (
              <div key={customer.id} className="admin-list-row">
                <div>
                  <strong>{customer.display_name || customer.email || customer.phone || "Unnamed customer"}</strong>
                  <span>{[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details saved"}</span>
                </div>
                <em className={String(customer.status || "").toLowerCase() === "active" ? "good" : "muted"}>{customer.status || "active"}</em>
              </div>
            ))}
            {!customerRows.length ? <div className="admin-empty-state"><div><Users size={20} /><p>No customers yet.</p></div></div> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
