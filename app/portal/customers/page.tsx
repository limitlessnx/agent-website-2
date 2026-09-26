import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type Customer = { id:string; full_name?:string|null; email?:string|null; phone?:string|null; company_name?:string|null; status?:string|null; updated_at:string };
type Lead = { id:string; customer_id?:string|null; source?:string|null; stage?:string|null; score?:number|null; summary?:string|null; updated_at:string };

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers | Fluxknight" };

export default async function CustomersPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["customers.view","customers.manage"]); } catch { redirect("/portal"); }

  const [customers, leads] = await Promise.all([
    supabaseServerRequest<Customer[]>(`crm_customers?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,full_name,email,phone,company_name,status,updated_at&order=updated_at.desc&limit=50`).catch(() => []),
    supabaseServerRequest<Lead[]>(`crm_leads?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,customer_id,source,stage,score,summary,updated_at&order=updated_at.desc&limit=50`).catch(() => []),
  ]);

  return <main className="portal-page">
    <section className="portal-command-hero"><div><p className="portal-kicker">Customers</p><h1>Leads and customers</h1><p>People and opportunities currently known to your Fluxknight systems.</p></div></section>
    <section className="portal-business-metrics">
      <article className="portal-business-metric"><span>Customers</span><strong>{customers.length}</strong><small>recent records</small></article>
      <article className="portal-business-metric"><span>Leads</span><strong>{leads.length}</strong><small>recent opportunities</small></article>
    </section>
    <section className="portal-card"><div className="portal-card-head"><div><h2>Recent customers</h2><p>Tenant-scoped CRM records only.</p></div></div>
      <div className="portal-list">{customers.map((customer)=><div className="portal-list-row" key={customer.id}><div><strong>{customer.full_name || customer.company_name || "Unnamed customer"}</strong><span>{customer.email || customer.phone || "No contact detail"} · {customer.status || "active"}</span></div><em>{new Date(customer.updated_at).toLocaleDateString("en-NG")}</em></div>)}{!customers.length?<p className="portal-empty">No customer records yet.</p>:null}</div>
    </section>
  </main>;
}
