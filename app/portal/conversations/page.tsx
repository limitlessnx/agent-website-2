import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type Conversation = { id:string; customer_id?:string|null; channel?:string|null; status?:string|null; started_at?:string|null; updated_at:string };

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversations | Fluxknight" };

export default async function ConversationsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["conversations.view","conversations.reply"]); } catch { redirect("/portal"); }
  const conversations = await supabaseServerRequest<Conversation[]>(
    `crm_conversations?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,customer_id,channel,status,started_at,updated_at&order=updated_at.desc&limit=60`,
  ).catch(() => []);

  return <main className="portal-page">
    <section className="portal-command-hero"><div><p className="portal-kicker">Conversations</p><h1>Customer conversations</h1><p>Tenant-scoped communication activity across connected channels.</p></div></section>
    <section className="portal-card"><div className="portal-list">{conversations.map((item)=><div className="portal-list-row" key={item.id}><div><strong>{(item.channel || "conversation").replaceAll("_"," ")}</strong><span>{item.status || "open"} · {item.customer_id ? `Customer ${item.customer_id.slice(0,8)}` : "Unlinked customer"}</span></div><em>{new Date(item.updated_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</em></div>)}{!conversations.length?<p className="portal-empty">No conversations recorded yet.</p>:null}</div></section>
  </main>;
}
