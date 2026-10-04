import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { getOrganizationAccessContext } from "@/lib/organization-membership";
import CustomerStageControl from "./CustomerStageControl";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type Customer={id:string;full_name?:string|null;email?:string|null;phone?:string|null;company_name?:string|null;status:string;current_stage_id?:string|null;stage_updated_at?:string|null;created_at:string;updated_at:string};
type Stage={id:string;key:string;name:string;category:string;position:number};
type Timeline={id:string;event_type:string;channel?:string|null;title:string;summary?:string|null;occurred_at:string;source_table?:string|null;correlation_id?:string|null;actor_type?:string|null};
type Conversation={id:string;channel:string;status:string;started_at:string;updated_at:string};
type Handoff={id:string;conversation_id:string;reason:string;category:string;priority:string;status:string;conversation_summary?:string|null;next_action?:string|null;created_at:string;updated_at:string};

export const dynamic="force-dynamic";

export default async function CustomerTimelinePage({params}:{params:Promise<{id:string}>}){
  const session=await getClientSession();
  if(!session) redirect("/account/login");
  try{await requirePortalPermission(session,["customers.view","customers.manage"]);}catch{redirect("/portal");}
  const {id}=await params;
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  const org=encodeURIComponent(session.organizationId);
  const cid=encodeURIComponent(id);
  const [customers,timeline,conversations,stages,handoffs]=await Promise.all([
    supabaseServerRequest<Customer[]>("crm_customers?organization_id=eq."+org+"&id=eq."+cid+"&select=id,full_name,email,phone,company_name,status,current_stage_id,stage_updated_at,created_at,updated_at&limit=1").catch(()=>[]),
    supabaseServerRequest<Timeline[]>("customer_timeline_events?organization_id=eq."+org+"&customer_id=eq."+cid+"&select=id,event_type,channel,title,summary,occurred_at,source_table,correlation_id,actor_type&order=occurred_at.desc&limit=200").catch(()=>[]),
    supabaseServerRequest<Conversation[]>("crm_conversations?organization_id=eq."+org+"&customer_id=eq."+cid+"&select=id,channel,status,started_at,updated_at&order=updated_at.desc&limit=50").catch(()=>[]),
    supabaseServerRequest<Stage[]>("organization_customer_stages?organization_id=eq."+org+"&status=eq.active&select=id,key,name,category,position&order=position.asc&limit=100").catch(()=>[]),
    supabaseServerRequest<Handoff[]>("human_handoffs?organization_id=eq."+org+"&customer_id=eq."+cid+"&select=id,conversation_id,reason,category,priority,status,conversation_summary,next_action,created_at,updated_at&order=created_at.desc&limit=50").catch(()=>[]),
  ]);
  const customer=customers[0];
  if(!customer) notFound();

  return <main className="portal-page">
    <section className="portal-command-hero"><div>
      <p className="portal-kicker">Customer</p>
      <h1>{customer.full_name||customer.company_name||"Unnamed customer"}</h1>
      <p>{customer.email||"No email"} · {customer.phone||"No phone"} · {customer.status}</p>
    </div><Link href="/portal/customers">Back to customers</Link></section>

    <section className="portal-business-metrics">
      <article className="portal-business-metric"><span>Timeline events</span><strong>{timeline.length}</strong><small>recent activity</small></article>
      <article className="portal-business-metric"><span>Conversations</span><strong>{conversations.length}</strong><small>across channels</small></article>
      <article className="portal-business-metric"><span>Known since</span><strong>{new Date(customer.created_at).toLocaleDateString("en-NG")}</strong><small>canonical CRM record</small></article>
    </section>

    <section className="portal-card">
      <div className="portal-card-head"><div><h2>Customer stage</h2><p>AI and human teammates use the same organization-defined stage.</p></div></div>
      <CustomerStageControl customerId={customer.id} currentStageId={customer.current_stage_id} stages={stages} canManage={access.permissions.has("customers.manage")} />
    </section>

    <section className="portal-card">
      <div className="portal-card-head"><div><h2>Unified timeline</h2><p>Messages, appointments and system activity for this customer across installed channels.</p></div></div>
      <div className="portal-list">
        {timeline.map((item)=><div className="portal-list-row" key={item.id}><div>
          <strong>{item.title}</strong>
          <span>{item.channel?item.channel+" · ":""}{item.summary||item.event_type}</span>
        </div><em>{new Date(item.occurred_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</em></div>)}
        {!timeline.length?<p className="portal-empty">No canonical timeline events yet.</p>:null}
      </div>
    </section>

    <section className="portal-card">
      <div className="portal-card-head"><div><h2>Conversation history</h2><p>Expand a previous conversation to see its summary and current state, then open the full evidence.</p></div></div>
      <div className="portal-list">
        {conversations.map((item)=>{
          const latest=handoffs.find((handoff)=>handoff.conversation_id===item.id);
          return <details className="portal-list-row" key={item.id}>
            <summary style={{cursor:"pointer",listStyle:"none"}}>
              <div><strong>{item.channel.replaceAll("_"," ")} · {item.status.replaceAll("_"," ")}</strong><span>Updated {new Date(item.updated_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</span></div>
            </summary>
            <div className="portal-list" style={{marginTop:12}}>
              <div className="portal-list-row"><div><strong>Current conversation</strong><span>{item.status.replaceAll("_"," ")}</span></div><Link href={"/portal/conversations/"+item.id}>Open conversation</Link></div>
              {latest?<div className="portal-list-row"><div><strong>Latest handoff summary</strong><span>{latest.conversation_summary||latest.reason}</span><span>{latest.category.replaceAll("_"," ")} · {latest.priority} · {latest.status.replaceAll("_"," ")}</span>{latest.next_action?<span>Next action: {latest.next_action}</span>:null}</div><em>{new Date(latest.updated_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</em></div>:<p className="portal-empty">No human handoff recorded for this conversation.</p>}
            </div>
          </details>;
        })}
        {!conversations.length?<p className="portal-empty">No conversations linked yet.</p>:null}
      </div>
    </section>
  </main>;
}
