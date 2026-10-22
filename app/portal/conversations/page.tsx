import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";

type Conversation = { id:string; customer_id?:string|null; channel?:string|null; status?:string|null; started_at?:string|null; updated_at:string };

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversations | Fluxknight" };

export default async function ConversationsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["conversations.view","conversations.reply"]); } catch { redirect("/portal"); }
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  const photography = profile?.industry === "photography-studio";
  const conversations = await supabaseServerRequest<Conversation[]>(
    `crm_conversations?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,customer_id,channel,status,started_at,updated_at&order=updated_at.desc&limit=60`,
  ).catch(() => []);

  return <main className="portal-page">
    <section className="portal-command-hero"><div><p className="portal-kicker">{photography ? "Clients & inbox" : "Conversations"}</p><h1>{photography ? "Client conversations" : "Customer conversations"}</h1><p>{photography ? "Manage package questions, availability requests and booking conversations from one studio inbox." : "Tenant-scoped communication activity across connected channels."}</p></div></section>
    {photography ? <section className="exposure-inbox-panel"><div className="exposure-inbox-tabs"><span className="active">Inbox <b>{conversations.length}</b></span><span>Clients</span></div><div className="exposure-inbox-search">⌕ <span>Search conversations...</span></div><div className="exposure-inbox-filters"><span className="active">All {conversations.length}</span><span>Unread</span><span>Bookings</span></div><div className="exposure-inbox-list">{conversations.map((item)=><Link href={"/portal/conversations/"+item.id} className="exposure-inbox-row" key={item.id}><span className="exposure-inbox-avatar">{(item.customer_id || "CL").slice(0,2).toUpperCase()}</span><div><strong>{item.customer_id ? `Client ${item.customer_id.slice(0,8)}` : "Unlinked client"}</strong><small>{(item.channel || "conversation").replaceAll("_", " ")} · {item.status || "open"}</small></div><time>{new Date(item.updated_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}<b>1</b></time></Link>)}{!conversations.length?<p className="portal-empty">No client conversations recorded yet.</p>:null}</div></section> : <section className="portal-card"><div className="portal-list">{conversations.map((item)=><Link href={"/portal/conversations/"+item.id} className="portal-list-row" key={item.id}><div><strong>{(item.channel || "conversation").replaceAll("_"," ")}</strong><span>{item.status || "open"} · {item.customer_id ? `Customer ${item.customer_id.slice(0,8)}` : "Unlinked customer"}</span></div><em>{new Date(item.updated_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</em></Link>)}{!conversations.length?<p className="portal-empty">No conversations recorded yet.</p>:null}</div></section>}
  </main>;
}
