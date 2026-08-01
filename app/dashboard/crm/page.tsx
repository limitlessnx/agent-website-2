import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const { supabase, organizationId } = await requireTenant();
  const [{ data: customers }, { data: leads }] = await Promise.all([
    supabase.from("crm_customers").select("id,display_name,email,phone,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("crm_leads").select("id,title,status,stage,source,created_at,customer_id").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
  ]);

  return <main className="admin-page"><div className="admin-page-header"><div><p className="admin-kicker">CRM</p><h1>Customers and leads</h1><p className="admin-muted">Every query is scoped to your authenticated organisation and still enforced by RLS.</p></div></div><section className="admin-grid"><article className="admin-card"><h2>Customers</h2>{customers?.map((customer) => <div key={customer.id} className="admin-list-row"><strong>{customer.display_name || customer.email || customer.phone || "Unnamed customer"}</strong><span>{customer.status}</span></div>) || <p>No customers yet.</p>}</article><article className="admin-card"><h2>Leads</h2>{leads?.map((lead) => <div key={lead.id} className="admin-list-row"><strong>{lead.title}</strong><span>{lead.stage} · {lead.status}</span></div>) || <p>No leads yet.</p>}</article></section></main>;
}
