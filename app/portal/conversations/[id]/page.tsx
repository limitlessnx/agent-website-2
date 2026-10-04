import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext } from "@/lib/organization-membership";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import HumanWhatsAppComposer from "./HumanWhatsAppComposer";

type Conversation={id:string;customer_id:string;channel:string;status:string;metadata?:Record<string,unknown>|null;started_at:string;updated_at:string};
type Handoff={id:string;status:string;priority:string;category:string;reason:string;conversation_summary?:string|null;next_action?:string|null;metadata?:Record<string,unknown>|null;sla_due_at?:string|null;created_at:string;};
type Customer={id:string;full_name?:string|null;company_name?:string|null;email?:string|null;phone?:string|null;current_stage_id?:string|null};
type Message={id:string;sender_type:string;direction:string;content:string;status:string;created_at:string;metadata?:Record<string,unknown>|null};
type Stage={id:string;name:string};

export const dynamic="force-dynamic";

export default async function ConversationDetailPage({params}:{params:Promise<{id:string}>}){
  const session=await getClientSession();
  if(!session) redirect("/account/login");
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  if(!access.permissions.has("conversations.view")&&!access.permissions.has("conversations.reply")) redirect("/portal");
  const {id}=await params;
  const org=encodeURIComponent(session.organizationId);
  const cid=encodeURIComponent(id);

  const conversations=await supabaseServerRequest<Conversation[]>(
    "crm_conversations?organization_id=eq."+org+"&id=eq."+cid+"&select=id,customer_id,channel,status,metadata,started_at,updated_at&limit=1",
  ).catch(()=>[]);
  const conversation=conversations[0];
  if(!conversation) notFound();

  const [customers,messages,handoffRows,followUps,appointments]=await Promise.all([
    supabaseServerRequest<Customer[]>(
      "crm_customers?organization_id=eq."+org+"&id=eq."+encodeURIComponent(conversation.customer_id)+"&select=id,full_name,company_name,email,phone,current_stage_id&limit=1",
    ).catch(()=>[]),
    supabaseServerRequest<Message[]>(
      "crm_messages?organization_id=eq."+org+"&conversation_id=eq."+cid+"&select=id,sender_type,direction,content,status,created_at,metadata&order=created_at.asc&limit=300",
    ).catch(()=>[]),
    supabaseServerRequest<Handoff[]>(
      "human_handoffs?organization_id=eq."+org+"&conversation_id=eq."+cid+"&select=id,status,priority,category,reason,conversation_summary,next_action,metadata,sla_due_at,created_at&order=created_at.desc&limit=1",
    ).catch(()=>[]),
    supabaseServerRequest<Array<{id:string;status:string;scheduled_at?:string|null;message_sent?:string|null;channel?:string|null;stage?:number}>>(
      "follow_ups?organization_id=eq."+org+"&conversation_id=eq."+cid+"&select=id,status,scheduled_at,message_sent,channel,stage&order=scheduled_at.desc&limit=5",
    ).catch(()=>[]),
    supabaseServerRequest<Array<{id:string;title:string;start_at?:string|null;end_at?:string|null;status:string;customer_name?:string|null;location?:string|null}>>(
      "appointments?organization_id=eq."+org+"&conversation_id=eq."+cid+"&select=id,title,start_at,end_at,status,customer_name,location&order=start_at.desc&limit=5",
    ).catch(()=>[]),
  ]);
  const customer=customers[0];
  const latestFollowUp=followUps[0];
  const latestAppointment=appointments[0];

  let stage:Stage|null=null;
  if(customer?.current_stage_id){
    const rows=await supabaseServerRequest<Stage[]>(
      "organization_customer_stages?organization_id=eq."+org+"&id=eq."+encodeURIComponent(customer.current_stage_id)+"&select=id,name&limit=1",
    ).catch(()=>[]);
    stage=rows[0]||null;
  }

  const mode=String(conversation.metadata?.ai_response_mode||"active");
  const handoff=handoffRows[0];
  const structured=handoff?.metadata&&typeof handoff.metadata.structured_handoff==="object"&&!Array.isArray(handoff.metadata.structured_handoff)
    ? handoff.metadata.structured_handoff as Record<string,unknown>
    : {};
  const listValue=(value:unknown)=>Array.isArray(value)?value.filter((item)=>typeof item==="string"&&item.trim()).map(String):[];
  const keyPoints=listValue(structured.keyPoints);
  const customerQuestions=listValue(structured.customerQuestions);
  const intent=String(structured.customerIntent||structured.intent||handoff?.reason||"Intent not captured");
  const propertyContext=String(structured.property||structured.propertyInterest||structured.service||structured.serviceInterest||"Not specified");
  const summary=handoff?.conversation_summary||String(structured.summary||"Maia has not recorded a structured summary yet.");
  return <main className="portal-page">
    <section className="portal-command-hero"><div>
      <p className="portal-kicker">{conversation.channel.replaceAll("_"," ")} conversation</p>
      <h1>{customer?.full_name||customer?.company_name||"Customer"}</h1>
      <p>{stage?.name||"Stage not set"} · {conversation.status.replaceAll("_"," ")} · AI {mode.replaceAll("_"," ")}</p>
    </div><Link href="/portal/conversations">Back to conversations</Link></section>

    <section className="portal-card" aria-label="Customer context">
      <div className="portal-card-head"><div><p className="portal-kicker">Customer context</p><h2>Who Maia is speaking with</h2><p>The operational context your team needs before reading the transcript.</p></div></div>
      <div className="portal-list">
        <div className="portal-list-row"><div><strong>Customer</strong><span>{customer?.full_name||customer?.company_name||"Unknown customer"}</span></div><div><strong>Stage</strong><span>{stage?.name||"Not set"}</span></div></div>
        <div className="portal-list-row"><div><strong>Phone</strong><span>{customer?.phone||"Not provided"}</span></div><div><strong>Email</strong><span>{customer?.email||"Not provided"}</span></div></div>
      </div>
    </section>

    <section className="portal-card" aria-label="Maia summary">
      <div className="portal-card-head"><div><p className="portal-kicker">Maia summary</p><h2>{intent}</h2><p>{summary}</p></div></div>
      <div className="portal-list">
        <div className="portal-list-row"><div><strong>Intent / request</strong><span>{intent}</span></div><div><strong>Property / service</strong><span>{propertyContext}</span></div></div>
        <div className="portal-list-row"><div><strong>Needs & key points</strong>{keyPoints.length?keyPoints.map((point)=><span key={point}>• {point}</span>):<span>No structured needs captured yet.</span>}</div>{customerQuestions.length?<div><strong>Customer questions</strong>{customerQuestions.map((question)=><span key={question}>• {question}</span>)}</div>:null}</div>
      </div>
    </section>

    <section className="portal-business-metrics" aria-label="Conversation operations">
      <article className="portal-business-metric"><span>Stage</span><strong>{stage?.name||"Not set"}</strong><small>Current customer stage</small></article>
      <article className="portal-business-metric"><span>Follow-up</span><strong>{latestFollowUp?.status?.replaceAll("_"," ")||"None"}</strong><small>{latestFollowUp?.scheduled_at?new Date(latestFollowUp.scheduled_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"No scheduled follow-up"}</small></article>
      <article className="portal-business-metric"><span>Appointment</span><strong>{latestAppointment?.status?.replaceAll("_"," ")||"None"}</strong><small>{latestAppointment?.start_at?new Date(latestAppointment.start_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"No booking recorded"}</small></article>
      <article className="portal-business-metric"><span>Handoff</span><strong>{handoff?.status?.replaceAll("_"," ")||"Not required"}</strong><small>{handoff?.priority?handoff.priority+" priority":"No human escalation"}</small></article>
    </section>

    {handoff?<section className="portal-card" aria-label="Human handoff">
      <div className="portal-card-head"><div>
        <p className="portal-kicker">Human handoff</p>
        <h2>What the teammate needs to know</h2>
        <p>{handoff.next_action||"Review the conversation and assist the customer."}</p>
      </div></div>
      <div className="portal-list">
        <div className="portal-list-row">
          <div><strong>Current request</strong><span>{String(structured.customerIntent||handoff.reason||"Human assistance requested")}</span></div>
          <div><strong>Priority</strong><span>{handoff.priority.toUpperCase()}</span></div>
        </div>
        <div className="portal-list-row">
          <div><strong>Property</strong><span>{String(structured.property||structured.propertyInterest||"Not specified")}</span></div>
          <div><strong>Next action</strong><span>{handoff.next_action||"Review conversation and assist customer"}</span></div>
        </div>
        {handoff.conversation_summary?<div className="portal-list-row"><div><strong>Summary</strong><span>{handoff.conversation_summary}</span></div></div>:null}
        {keyPoints.length?<div className="portal-list-row"><div><strong>Key points</strong>{keyPoints.map((point)=><span key={point}>• {point}</span>)}</div></div>:null}
        {customerQuestions.length?<div className="portal-list-row"><div><strong>Customer questions</strong>{customerQuestions.map((question)=><span key={question}>• {question}</span>)}</div></div>:null}
        {(structured.requestedDate||structured.requestedTime||structured.availability)?<div className="portal-list-row"><div><strong>Requested timing</strong><span>{[structured.requestedDate,structured.requestedTime].filter(Boolean).join(" · ")||"Not specified"}</span><span>Availability: {String(structured.availability||"Not specified")}</span></div></div>:null}
        <div className="portal-list-row"><div><strong>Handover status</strong><span>{handoff.status.replaceAll("_"," ")} · {handoff.category.replaceAll("_"," ")}</span></div><div><strong>SLA</strong><span>{handoff.sla_due_at?new Date(handoff.sla_due_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"No SLA"}</span></div></div>
      </div>
    </section>:null}

    <section className="portal-card">
      <div className="portal-card-head"><div><p className="portal-kicker">Conversation evidence</p><h2>Conversation</h2><p>{customer?.phone||customer?.email||"No customer contact detail"}</p></div></div>
      <div className="portal-list">
        {messages.map((message)=><div className="portal-list-row" key={message.id}>
          <div>
            <strong>{message.sender_type==="customer"?"Customer":message.sender_type==="human"?"Human teammate":"AI / Business"}</strong>
            <span>{message.content}</span>
          </div>
          <em>{new Date(message.created_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</em>
        </div>)}
        {!messages.length?<p className="portal-empty">No messages recorded in this conversation yet.</p>:null}
      </div>
    </section>

    {conversation.channel==="whatsapp"
      ? <HumanWhatsAppComposer conversationId={conversation.id} canReply={access.permissions.has("conversations.reply")} />
      : null}
  </main>;
}
