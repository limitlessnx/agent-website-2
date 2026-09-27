import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext } from "@/lib/organization-membership";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import HumanWhatsAppComposer from "./HumanWhatsAppComposer";

type Conversation={id:string;customer_id:string;channel:string;status:string;metadata?:Record<string,unknown>|null;started_at:string;updated_at:string};
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

  const [customers,messages]=await Promise.all([
    supabaseServerRequest<Customer[]>(
      "crm_customers?organization_id=eq."+org+"&id=eq."+encodeURIComponent(conversation.customer_id)+"&select=id,full_name,company_name,email,phone,current_stage_id&limit=1",
    ).catch(()=>[]),
    supabaseServerRequest<Message[]>(
      "crm_messages?organization_id=eq."+org+"&conversation_id=eq."+cid+"&select=id,sender_type,direction,content,status,created_at,metadata&order=created_at.asc&limit=300",
    ).catch(()=>[]),
  ]);
  const customer=customers[0];

  let stage:Stage|null=null;
  if(customer?.current_stage_id){
    const rows=await supabaseServerRequest<Stage[]>(
      "organization_customer_stages?organization_id=eq."+org+"&id=eq."+encodeURIComponent(customer.current_stage_id)+"&select=id,name&limit=1",
    ).catch(()=>[]);
    stage=rows[0]||null;
  }

  const mode=String(conversation.metadata?.ai_response_mode||"active");
  return <main className="portal-page">
    <section className="portal-command-hero"><div>
      <p className="portal-kicker">{conversation.channel.replaceAll("_"," ")} conversation</p>
      <h1>{customer?.full_name||customer?.company_name||"Customer"}</h1>
      <p>{stage?.name||"Stage not set"} · {conversation.status.replaceAll("_"," ")} · AI {mode.replaceAll("_"," ")}</p>
    </div><Link href="/portal/conversations">Back to conversations</Link></section>

    <section className="portal-card">
      <div className="portal-card-head"><div><h2>Conversation</h2><p>{customer?.phone||customer?.email||"No customer contact detail"}</p></div></div>
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
