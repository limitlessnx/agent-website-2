import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";

type Customer = { id:string; full_name?:string|null; email?:string|null; phone?:string|null; company_name?:string|null; status?:string|null; updated_at:string };
type Lead = { id:string; customer_id?:string|null; source?:string|null; stage?:string|null; score?:number|null; summary?:string|null; updated_at:string };
type IdentityConflict = { id:string; identifier_type:string; normalized_value:string; customer_ids:string[]; reason:string; created_at:string };
const initials = (value:string) => value.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join("").toUpperCase() || "CL";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers | Fluxknight" };

export default async function CustomersPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["customers.view","customers.manage"]); } catch { redirect("/portal"); }
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  const photography = profile?.industry === "photography-studio";

  const [customers, leads, identityConflicts] = await Promise.all([
    supabaseServerRequest<Customer[]>(`crm_customers?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,full_name,email,phone,company_name,status,updated_at&order=updated_at.desc&limit=50`).catch(() => []),
    supabaseServerRequest<Lead[]>(`crm_leads?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,customer_id,source,stage,score,summary,updated_at&order=updated_at.desc&limit=50`).catch(() => []),
    supabaseServerRequest<IdentityConflict[]>(`customer_identity_conflicts?organization_id=eq.${encodeURIComponent(session.organizationId)}&status=eq.open&select=id,identifier_type,normalized_value,customer_ids,reason,created_at&order=created_at.desc&limit=20`).catch(() => []),
  ]);

  return <main className="portal-page">
    <section className="portal-command-hero"><div><p className="portal-kicker">{photography ? "Clients & enquiries" : "Customers"}</p><h1>{photography ? "Clients and studio enquiries" : "Leads and customers"}</h1><p>{photography ? "Keep every shoot request, client conversation and booking opportunity organized in one place." : "People and opportunities currently known to your Fluxknight systems."}</p></div></section>
    <section className="portal-business-metrics">
      <article className="portal-business-metric"><span>{photography ? "Clients" : "Customers"}</span><strong>{customers.length}</strong><small>recent records</small></article>
      <article className="portal-business-metric"><span>{photography ? "Shoot enquiries" : "Leads"}</span><strong>{leads.length}</strong><small>{photography ? "booking opportunities" : "recent opportunities"}</small></article>
      {identityConflicts.length?<article className="portal-business-metric"><span>Identity review</span><strong>{identityConflicts.length}</strong><small>possible duplicate customers</small></article>:null}
    </section>
    <section className="portal-card"><div className="portal-card-head"><div><h2>{photography ? "Recent studio clients" : "Recent customers"}</h2><p>Tenant-scoped CRM records only.</p></div></div>
      {photography ? <div className="exposure-client-grid">{customers.map((customer)=><Link href={`/portal/customers/${customer.id}`} className="exposure-client-card" key={customer.id}><span className="exposure-client-avatar">{initials(customer.full_name || customer.company_name || "Client")}</span><div className="exposure-client-main"><strong>{customer.full_name || customer.company_name || "Unnamed customer"}</strong><small>{customer.email || customer.phone || "No contact detail"}</small><span>{customer.status || "active"} · Updated {new Date(customer.updated_at).toLocaleDateString("en-NG")}</span></div><em>Open profile <span aria-hidden="true">↗</span></em></Link>)}{!customers.length?<p className="portal-empty">No studio clients yet.</p>:null}</div> : <div className="portal-list">{customers.map((customer)=><Link href={`/portal/customers/${customer.id}`} className="portal-list-row" key={customer.id}><div><strong>{customer.full_name || customer.company_name || "Unnamed customer"}</strong><span>{customer.email || customer.phone || "No contact detail"} · {customer.status || "active"}</span></div><em>{new Date(customer.updated_at).toLocaleDateString("en-NG")}</em></Link>)}{!customers.length?<p className="portal-empty">No customer records yet.</p>:null}</div>}
    </section>
    {identityConflicts.length?<section className="portal-card">
      <div className="portal-card-head"><div><h2>Identity review</h2><p>Possible duplicate customer identities are held for human review. Fluxknight does not silently merge them.</p></div></div>
      <div className="portal-list">{identityConflicts.map((item)=><div className="portal-list-row" key={item.id}><div><strong>{item.identifier_type.replaceAll("_"," ")} conflict</strong><span>{item.reason} · {item.customer_ids.length} customer records</span></div><em>{new Date(item.created_at).toLocaleDateString("en-NG")}</em></div>)}</div>
    </section>:null}
  </main>;
}
