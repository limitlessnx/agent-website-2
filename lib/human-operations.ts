import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationAccessContext, assertAnyOrganizationPermission, listOrganizationMembers } from "@/lib/organization-membership";
import type { ClientSession } from "@/lib/client-auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

type HandoffAssignment = { membershipId:string|null; notifyWhatsApp:boolean; notifyDashboard:boolean; source:string };
type StructuredHandoff = {
  customerIntent:string|null;
  property:string|null;
  propertyInterest:string|null;
  keyPoints:string[];
  customerQuestions:string[];
  requestedDate:string|null;
  requestedTime:string|null;
  availability:string|null;
  followUpRequired:boolean|null;
};

function str(value:unknown){ return typeof value==="string"?value.trim():""; }
function rec(value:unknown):Record<string,unknown>{ return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{}; }
function stringList(value:unknown,max=8){ return Array.isArray(value)?value.map(str).filter(Boolean).slice(0,max):[]; }
function structuredHandoff(payload:Record<string,unknown>):StructuredHandoff{
  return {
    customerIntent:str(payload.customerIntent||payload.customer_intent)||null,
    property:str(payload.property||payload.propertyTitle||payload.property_title)||null,
    propertyInterest:str(payload.propertyInterest||payload.property_interest)||null,
    keyPoints:stringList(payload.keyPoints||payload.key_points),
    customerQuestions:stringList(payload.customerQuestions||payload.customer_questions),
    requestedDate:str(payload.requestedDate||payload.requested_date)||null,
    requestedTime:str(payload.requestedTime||payload.requested_time)||null,
    availability:str(payload.availability)||null,
    followUpRequired:typeof payload.followUpRequired==="boolean"?payload.followUpRequired:(typeof payload.follow_up_required==="boolean"?payload.follow_up_required:null),
  };
}

async function deriveHandoffSummary(organizationId:string,conversationId:string,payload:Record<string,unknown>){
  const supplied=str(payload.conversationSummary||payload.conversation_summary||payload.summary);
  if(supplied) return supplied.slice(0,4000);
  const admin=createAdminClient();
  const {data,error}=await admin.from("crm_messages")
    .select("direction,content,created_at")
    .eq("organization_id",organizationId)
    .eq("conversation_id",conversationId)
    .order("created_at",{ascending:false})
    .limit(12);
  if(error) throw error;
  const rows=[...(data||[])].reverse();
  if(!rows.length) return "No prior conversation summary was available.";
  return rows.map((row)=>`${row.direction==="inbound"?"Customer":"Business"}: ${String(row.content||"").slice(0,500)}`)
    .join("\n").slice(0,4000);
}

async function resolveHandoffAssignment(input:{
  organizationId:string; sourceSystemId:string; sourceAgentId:string|null; category:string; payload:Record<string,unknown>;
}):Promise<HandoffAssignment>{
  const admin=createAdminClient();
  const explicit=str(input.payload.assignedMembershipId||input.payload.assigned_membership_id);
  if(explicit){
    const {data}=await admin.from("organization_memberships").select("id")
      .eq("organization_id",input.organizationId).eq("id",explicit).eq("status","active").maybeSingle();
    if(data?.id) return {membershipId:String(data.id),notifyWhatsApp:true,notifyDashboard:true,source:"event_payload"};
  }

  const {data:rules,error:rulesError}=await admin.from("handoff_assignment_rules")
    .select("assigned_membership_id,category,source_system_id,notify_whatsapp,notify_dashboard,priority")
    .eq("organization_id",input.organizationId).eq("status","active")
    .order("priority",{ascending:true}).limit(100);
  if(rulesError) throw rulesError;
  const rule=(rules||[]).find((item)=>
    (!item.category||item.category===input.category)&&(!item.source_system_id||item.source_system_id===input.sourceSystemId)
  );
  if(rule?.assigned_membership_id){
    const {data}=await admin.from("organization_memberships").select("id").eq("organization_id",input.organizationId)
      .eq("id",rule.assigned_membership_id).eq("status","active").maybeSingle();
    if(data?.id) return {
      membershipId:String(data.id),
      notifyWhatsApp:rule.notify_whatsapp!==false,
      notifyDashboard:rule.notify_dashboard!==false,
      source:"assignment_rule",
    };
  }

  if(input.sourceAgentId){
    const {data:agent}=await admin.from("agents").select("human_handoff_destination")
      .eq("organization_id",input.organizationId).eq("id",input.sourceAgentId).maybeSingle();
    const destination=rec(agent?.human_handoff_destination);
    const membershipId=str(destination.membership_id||destination.membershipId||destination.assigned_membership_id);
    if(membershipId){
      const {data}=await admin.from("organization_memberships").select("id").eq("organization_id",input.organizationId)
        .eq("id",membershipId).eq("status","active").maybeSingle();
      if(data?.id) return {membershipId:String(data.id),notifyWhatsApp:true,notifyDashboard:true,source:"agent_destination"};
    }
  }

  return {membershipId:null,notifyWhatsApp:false,notifyDashboard:true,source:"unassigned_queue"};
}

async function notifyHandoffAssignee(input:{
  organizationId:string; handoffId:string; conversationId:string; membershipId:string; customerName:string; stageName:string|null;
  summary:string; nextAction:string|null; notifyWhatsApp:boolean; notifyDashboard:boolean;
}){
  const admin=createAdminClient();
  const now=new Date().toISOString();
  if(input.notifyDashboard){
    await admin.from("handoff_notifications").insert({
      organization_id:input.organizationId,handoff_id:input.handoffId,membership_id:input.membershipId,
      channel:"dashboard",status:"sent",sent_at:now,
      metadata:{customer_name:input.customerName,stage_name:input.stageName,next_action:input.nextAction},
    });
  }

  if(!input.notifyWhatsApp) return;
  const {data:pref,error:prefError}=await admin.from("organization_member_notification_preferences")
    .select("whatsapp_phone,notify_whatsapp_handoffs")
    .eq("organization_id",input.organizationId).eq("membership_id",input.membershipId).maybeSingle();
  if(prefError) throw prefError;
  if(!pref?.notify_whatsapp_handoffs||!str(pref.whatsapp_phone)) return;

  const {data:notification,error:notificationError}=await admin.from("handoff_notifications").insert({
    organization_id:input.organizationId,handoff_id:input.handoffId,membership_id:input.membershipId,
    channel:"whatsapp",recipient:str(pref.whatsapp_phone),status:"pending",
    metadata:{customer_name:input.customerName,stage_name:input.stageName,next_action:input.nextAction},
  }).select("id").single();
  if(notificationError) throw notificationError;

  try{
    const result=await sendWhatsAppMessage({
      organizationId:input.organizationId,
      to:str(pref.whatsapp_phone),
      text:`New customer handoff: ${input.customerName}\nStage: ${input.stageName||"Not set"}\nSummary: ${input.summary}\nNext action: ${input.nextAction||"Review customer conversation"}`,
      deliveryMode:"direct",
      recipientType:"internal_staff",
    });
    await admin.from("handoff_notifications").update({
      status:"sent",provider_message_id:result.providerMessageId||null,sent_at:new Date().toISOString(),error_message:null,
    }).eq("id",notification.id);
  }catch(error){
    await admin.from("handoff_notifications").update({
      status:"failed",error_message:(error instanceof Error?error.message:"WhatsApp handoff notification failed.").slice(0,2000),
    }).eq("id",notification.id);
  }
}

export type HumanHandoffRow={
  id:string; customer_id:string; conversation_id:string; reason:string; category:string; priority:string; status:string;
  assigned_membership_id?:string|null; claimed_by_membership_id?:string|null; sla_due_at?:string|null;
  conversation_summary?:string|null; stage_id_at_handoff?:string|null; next_action?:string|null; outcome?:string|null;
  follow_up_required?:boolean; follow_up_due_at?:string|null; follow_up_status?:string|null; notified_at?:string|null;
  customer_name?:string|null; stage_name?:string|null; assigned_to_email?:string|null;
  metadata?:Record<string,unknown>|null;
  whatsapp_notification_status?:string|null; whatsapp_notification_error?:string|null;
  created_at:string; updated_at:string; resolution_summary?:string|null;
};
export type OperationApprovalRow={
  id:string; approval_type:string; title:string; description?:string|null; risk_level:string; status:string;
  requested_by_type:string; requested_by_id?:string|null; subject_type?:string|null; subject_id?:string|null;
  action_key:string; preview?:Record<string,unknown>|null; assigned_membership_id?:string|null;
  requested_at:string; expires_at?:string|null; decided_at?:string|null;
};

export async function listHumanOperations(session:ClientSession){
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  const admin=createAdminClient();
  const canHandoffs=access.permissions.has("handoffs.view")||access.permissions.has("handoffs.manage");
  const canApprovals=access.permissions.has("approvals.view")||access.permissions.has("approvals.manage");
  const [handoffsResult,approvalsResult,members]=await Promise.all([
    canHandoffs
      ? admin.from("human_handoffs").select("id,customer_id,conversation_id,reason,category,priority,status,assigned_membership_id,claimed_by_membership_id,sla_due_at,conversation_summary,stage_id_at_handoff,next_action,outcome,follow_up_required,follow_up_due_at,follow_up_status,notified_at,metadata,created_at,updated_at,resolution_summary").eq("organization_id",session.organizationId).not("status","in",'(resolved,closed)').order("created_at",{ascending:false}).limit(100)
      : Promise.resolve({data:[],error:null}),
    canApprovals
      ? admin.from("operation_approvals").select("id,approval_type,title,description,risk_level,status,requested_by_type,requested_by_id,subject_type,subject_id,action_key,preview,assigned_membership_id,requested_at,expires_at,decided_at").eq("organization_id",session.organizationId).eq("status","pending").order("requested_at",{ascending:false}).limit(100)
      : Promise.resolve({data:[],error:null}),
    canHandoffs ? listOrganizationMembers(session.organizationId,session.userId).catch(()=>[]) : Promise.resolve([]),
  ]);
  if(handoffsResult.error) throw handoffsResult.error;
  if(approvalsResult.error) throw approvalsResult.error;
  const handoffRows=(handoffsResult.data||[]) as HumanHandoffRow[];
  const customerIds=[...new Set(handoffRows.map((item)=>item.customer_id).filter(Boolean))];
  const stageIds=[...new Set(handoffRows.map((item)=>item.stage_id_at_handoff).filter(Boolean))] as string[];
  const [customersResult,stagesResult,notificationsResult]=await Promise.all([
    customerIds.length
      ? admin.from("crm_customers").select("id,full_name,company_name").eq("organization_id",session.organizationId).in("id",customerIds)
      : Promise.resolve({data:[],error:null}),
    stageIds.length
      ? admin.from("organization_customer_stages").select("id,name").eq("organization_id",session.organizationId).in("id",stageIds)
      : Promise.resolve({data:[],error:null}),
    handoffRows.length
      ? admin.from("handoff_notifications").select("handoff_id,status,error_message,created_at").eq("organization_id",session.organizationId).eq("channel","whatsapp").in("handoff_id",handoffRows.map((item)=>item.id)).order("created_at",{ascending:false}).limit(200)
      : Promise.resolve({data:[],error:null}),
  ]);
  if(customersResult.error) throw customersResult.error;
  if(stagesResult.error) throw stagesResult.error;
  if(notificationsResult.error) throw notificationsResult.error;
  const customerNameById=new Map((customersResult.data||[]).map((row)=>[row.id,String(row.full_name||row.company_name||"Customer")]));
  const stageNameById=new Map((stagesResult.data||[]).map((row)=>[row.id,String(row.name||"")]));
  const notificationByHandoff=new Map<string,{status:string;error_message:string|null}>();
  for(const notification of notificationsResult.data||[]){
    if(!notificationByHandoff.has(String(notification.handoff_id))){
      notificationByHandoff.set(String(notification.handoff_id),{status:String(notification.status||"unknown"),error_message:notification.error_message?String(notification.error_message):null});
    }
  }
  const memberEmailById=new Map(members.map((member)=>[member.id,member.email||null]));
  const handoffs=handoffRows.map((item)=>({
    ...item,
    customer_name:customerNameById.get(item.customer_id)||"Customer",
    stage_name:item.stage_id_at_handoff?stageNameById.get(item.stage_id_at_handoff)||null:null,
    assigned_to_email:item.assigned_membership_id?memberEmailById.get(item.assigned_membership_id)||null:null,
    whatsapp_notification_status:notificationByHandoff.get(item.id)?.status||null,
    whatsapp_notification_error:notificationByHandoff.get(item.id)?.error_message||null,
  }));

  return {
    handoffs,
    approvals:(approvalsResult.data||[]) as OperationApprovalRow[],
    members,
    permissions:[...access.permissions],
    membershipId:access.membershipId,
  };
}

export async function claimHumanHandoff(session:ClientSession,handoffId:string){
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  assertAnyOrganizationPermission(access,["handoffs.view","handoffs.manage"]);
  const admin=createAdminClient();
  const {data:handoff,error}=await admin.from("human_handoffs").select("*").eq("organization_id",session.organizationId).eq("id",handoffId).maybeSingle();
  if(error) throw error;
  if(!handoff) throw new Error("Handoff not found.");
  if(["resolved","closed"].includes(handoff.status)) throw new Error("Handoff is already closed.");
  if(handoff.assigned_membership_id&&handoff.assigned_membership_id!==access.membershipId&&!access.permissions.has("handoffs.manage")){
    throw new Error("This handoff is assigned to another team member.");
  }
  const {data,error:updateError}=await admin.from("human_handoffs").update({
    assigned_membership_id:handoff.assigned_membership_id||access.membershipId,
    claimed_by_membership_id:access.membershipId,status:"in_progress",
    claimed_at:handoff.claimed_at||new Date().toISOString(),updated_at:new Date().toISOString(),
  }).eq("organization_id",session.organizationId).eq("id",handoffId).select().single();
  if(updateError) throw updateError;
  const {data:conversation}=await admin.from("crm_conversations").select("metadata")
    .eq("organization_id",session.organizationId).eq("id",handoff.conversation_id).maybeSingle();
  await admin.from("crm_conversations").update({
    status:"human_active",
    metadata:{...((conversation?.metadata||{}) as Record<string,unknown>),active_handoff_id:handoffId,ai_response_mode:"human_takeover"},
    updated_at:new Date().toISOString(),
  }).eq("organization_id",session.organizationId).eq("id",handoff.conversation_id);
  return data;
}

export async function assignHumanHandoff(session:ClientSession,handoffId:string,membershipId:string){
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  assertAnyOrganizationPermission(access,["handoffs.manage"]);
  const admin=createAdminClient();
  const {data:member,error:memberError}=await admin.from("organization_memberships").select("id").eq("organization_id",session.organizationId).eq("id",membershipId).eq("status","active").maybeSingle();
  if(memberError) throw memberError;
  if(!member) throw new Error("Assignee must be an active member of this organization.");
  const {data,error}=await admin.from("human_handoffs").update({
    assigned_membership_id:membershipId,status:"assigned",updated_at:new Date().toISOString(),
  }).eq("organization_id",session.organizationId).eq("id",handoffId).not("status","in",'(resolved,closed)').select().maybeSingle();
  if(error) throw error;
  if(!data) throw new Error("Handoff could not be assigned.");
  const {data:customer}=await admin.from("crm_customers").select("full_name,company_name,current_stage_id")
    .eq("organization_id",session.organizationId).eq("id",data.customer_id).maybeSingle();
  let stageName:string|null=null;
  if(customer?.current_stage_id){
    const {data:stage}=await admin.from("organization_customer_stages").select("name")
      .eq("organization_id",session.organizationId).eq("id",customer.current_stage_id).maybeSingle();
    stageName=stage?.name||null;
  }
  await notifyHandoffAssignee({
    organizationId:session.organizationId,
    handoffId,
    conversationId:String(data.conversation_id),
    membershipId,
    customerName:String(customer?.full_name||customer?.company_name||"Customer"),
    stageName,
    summary:String(data.conversation_summary||data.reason||"Review customer conversation"),
    nextAction:data.next_action||null,
    notifyWhatsApp:true,
    notifyDashboard:true,
  }).catch(()=>undefined);
  return data;
}

export async function resolveHumanHandoff(session:ClientSession,handoffId:string,resolution:string,resumeAi:boolean,options:{outcome?:string|null;nextAction?:string|null;stageId?:string|null;followUpRequired?:boolean;followUpMinutes?:number|null}={}){
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  const admin=createAdminClient();
  const {data:handoff,error}=await admin.from("human_handoffs").select("*").eq("organization_id",session.organizationId).eq("id",handoffId).maybeSingle();
  if(error) throw error;
  if(!handoff) throw new Error("Handoff not found.");
  const owns=handoff.assigned_membership_id===access.membershipId||handoff.claimed_by_membership_id===access.membershipId;
  if(!owns&&!access.permissions.has("handoffs.manage")) throw new Error("Only the assignee, claimant, or handoff manager can resolve this handoff.");
  const now=new Date().toISOString();
  const followUpRequired=options.followUpRequired!==false;
  const followUpMinutes=Math.max(5,Math.min(10080,Number(options.followUpMinutes||720)));
  const followUpDueAt=followUpRequired?new Date(Date.now()+followUpMinutes*60_000).toISOString():null;
  const {data,error:updateError}=await admin.from("human_handoffs").update({
    status:"resolved",
    resolved_at:now,
    resolution_summary:resolution.trim()||null,
    outcome:str(options.outcome)||null,
    next_action:str(options.nextAction)||handoff.next_action||null,
    follow_up_required:followUpRequired,
    follow_up_due_at:followUpDueAt,
    follow_up_status:followUpRequired?"scheduled":"not_required",
    updated_at:now,
  }).eq("organization_id",session.organizationId).eq("id",handoffId).select().single();
  if(updateError) throw updateError;

  const {data:conversation}=await admin.from("crm_conversations").select("metadata").eq("organization_id",session.organizationId).eq("id",handoff.conversation_id).maybeSingle();
  const metadata={...((conversation?.metadata||{}) as Record<string,unknown>)};
  delete metadata.active_handoff_id;
  Object.assign(metadata,{ai_response_mode:resumeAi?"active":"stopped",last_resolved_handoff_id:handoffId});
  await admin.from("crm_conversations").update({
    status:resumeAi?"ai_active":"resolved",metadata,updated_at:now,
  }).eq("organization_id",session.organizationId).eq("id",handoff.conversation_id);

  if(str(options.stageId)){
    await (admin as any).rpc("update_customer_stage",{
      p_organization_id:session.organizationId,
      p_customer_id:handoff.customer_id,
      p_stage_id:str(options.stageId),
      p_changed_by_type:"human",
      p_changed_by_id:access.membershipId,
      p_reason:resolution.trim()||null,
      p_source:"handoff_resolution",
      p_metadata:{handoff_id:handoffId},
    });
  }

  if(followUpRequired&&followUpDueAt){
    await admin.from("crm_tasks").insert({
      organization_id:session.organizationId,
      customer_id:handoff.customer_id,
      task_type:"handoff_follow_up",
      title:"Post-handoff customer check-in",
      description:"Confirm the customer received the help they needed after human handoff.",
      status:"scheduled",
      due_at:followUpDueAt,
      metadata:{
        handoff_id:handoffId,
        conversation_id:handoff.conversation_id,
        next_action:str(options.nextAction)||handoff.next_action||null,
        source_system_id:handoff.source_system_id||null,
        channel:"whatsapp",
      },
    });
  }

  await (admin as any).rpc("add_customer_timeline_event",{
    p_organization_id:session.organizationId,p_customer_id:handoff.customer_id,
    p_event_type:"handoff.resolved",p_title:"Human handoff resolved",p_summary:resolution.trim()||null,
    p_channel:"internal",p_conversation_id:handoff.conversation_id,p_source_table:"human_handoffs",p_source_id:handoffId,
    p_correlation_id:handoff.correlation_id||null,p_actor_type:"human",p_actor_id:access.membershipId,
    p_metadata:{
      resume_ai:resumeAi,
      outcome:str(options.outcome)||null,
      next_action:str(options.nextAction)||handoff.next_action||null,
      follow_up_required:followUpRequired,
      follow_up_due_at:followUpDueAt,
    },p_occurred_at:now,
  });
  return data;
}

export async function decideOperationApproval(session:ClientSession,approvalId:string,decision:"approved"|"rejected",reason:string){
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  assertAnyOrganizationPermission(access,["approvals.manage"]);
  const admin=createAdminClient();
  const {data:approval,error}=await admin.from("operation_approvals").select("*").eq("organization_id",session.organizationId).eq("id",approvalId).maybeSingle();
  if(error) throw error;
  if(!approval) throw new Error("Approval not found.");
  if(approval.status!=="pending") throw new Error("Approval is no longer pending.");
  if(approval.expires_at&&new Date(approval.expires_at).getTime()<=Date.now()) throw new Error("Approval request has expired.");
  if(approval.requested_by_type==="human"&&approval.requested_by_id===access.membershipId) throw new Error("Requester cannot self-approve.");
  const now=new Date().toISOString();
  const {data,error:updateError}=await admin.from("operation_approvals").update({
    status:decision,decided_by_membership_id:access.membershipId,decision_reason:reason.trim()||null,decided_at:now,updated_at:now,
  }).eq("organization_id",session.organizationId).eq("id",approvalId).eq("status","pending").select().maybeSingle();
  if(updateError) throw updateError;
  if(!data) throw new Error("Approval was already decided.");
  await admin.from("audit_logs").insert({
    organization_id:session.organizationId,action:`operation_approval.${decision}`,
    resource_type:"operation_approval",resource_id:approvalId,reason:reason.trim()||null,
    metadata:{membership_id:access.membershipId,action_key:approval.action_key,risk_level:approval.risk_level},
  });
  return data;
}


export async function createHandoffFromSystemEvent(event:{
  id:string;
  organizationId:string;
  customerId?:string|null;
  conversationId?:string|null;
  sourceSystemId:string;
  source?:string|null;
  correlationId:string;
  payload:Record<string,unknown>;
}){
  if(!event.customerId) throw new Error("handoff.requested requires customerId.");
  if(!event.conversationId) throw new Error("handoff.requested requires conversationId.");
  const admin=createAdminClient();
  const {data:existing,error:lookupError}=await admin.from("human_handoffs")
    .select("id,status,assigned_membership_id")
    .eq("organization_id",event.organizationId)
    .contains("metadata",{source_event_id:event.id})
    .limit(1)
    .maybeSingle();
  if(lookupError) throw lookupError;
  if(existing) return {handoffId:String(existing.id),status:String(existing.status),assignedMembershipId:existing.assigned_membership_id||null,duplicate:true};

  const payload=event.payload||{};
  const reason=str(payload.reason||payload.message)||"AI requested human assistance";
  const category=str(payload.category)||"general";
  const priorityRaw=str(payload.priority).toLowerCase()||"normal";
  const priority=["low","normal","high","critical"].includes(priorityRaw)?priorityRaw:"normal";
  const slaMinutes=Math.max(1,Math.min(10080,Number(payload.slaMinutes||payload.sla_minutes||60)));
  const sourceAgentId=str(event.source).startsWith("agent:")?str(event.source).slice("agent:".length):null;
  const summary=await deriveHandoffSummary(event.organizationId,event.conversationId,payload);
  const nextAction=str(payload.nextAction||payload.next_action)||null;
  const structured=structuredHandoff(payload);

  const {data:customer,error:customerError}=await admin.from("crm_customers")
    .select("full_name,company_name,current_stage_id")
    .eq("organization_id",event.organizationId).eq("id",event.customerId).maybeSingle();
  if(customerError) throw customerError;

  let stageId=customer?.current_stage_id||null;
  const stageKey=str(payload.stageKey||payload.stage_key);
  if(stageKey){
    const {data:stage,error:stageError}=await admin.from("organization_customer_stages")
      .select("id,name")
      .eq("organization_id",event.organizationId).eq("key",stageKey).eq("status","active").maybeSingle();
    if(stageError) throw stageError;
    if(stage?.id){
      stageId=stage.id;
      await (admin as any).rpc("update_customer_stage",{
        p_organization_id:event.organizationId,
        p_customer_id:event.customerId,
        p_stage_id:stage.id,
        p_changed_by_type:"agent",
        p_changed_by_id:sourceAgentId,
        p_reason:reason,
        p_source:"handoff_request",
        p_metadata:{source_event_id:event.id},
      });
    }
  }

  let stageName:string|null=null;
  if(stageId){
    const {data:stage}=await admin.from("organization_customer_stages").select("name")
      .eq("organization_id",event.organizationId).eq("id",stageId).maybeSingle();
    stageName=stage?.name||null;
  }

  const assignment=await resolveHandoffAssignment({
    organizationId:event.organizationId,
    sourceSystemId:event.sourceSystemId,
    sourceAgentId,
    category,
    payload,
  });

  const {data,error}=await (admin as any).rpc("create_human_handoff",{
    p_organization_id:event.organizationId,
    p_customer_id:event.customerId,
    p_conversation_id:event.conversationId,
    p_reason:reason,
    p_category:category,
    p_priority:priority,
    p_source_system_id:event.sourceSystemId,
    p_source_agent_id:sourceAgentId,
    p_correlation_id:event.correlationId,
    p_sla_due_at:new Date(Date.now()+slaMinutes*60_000).toISOString(),
    p_created_by_type:"agent",
    p_created_by_id:sourceAgentId||event.sourceSystemId,
    p_metadata:{
      source_event_id:event.id,
      source:"system_event",
      assignment_source:assignment.source,
      payload,
      structured_handoff:structured,
    },
  });
  if(error) throw error;
  const handoffId=String(data);

  const updatePayload:Record<string,unknown>={
    conversation_summary:summary,
    stage_id_at_handoff:stageId,
    next_action:nextAction,
    assigned_membership_id:assignment.membershipId,
    status:assignment.membershipId?"assigned":"open",
    updated_at:new Date().toISOString(),
  };
  const {error:updateError}=await admin.from("human_handoffs").update(updatePayload)
    .eq("organization_id",event.organizationId).eq("id",handoffId);
  if(updateError) throw updateError;

  if(assignment.membershipId){
    await notifyHandoffAssignee({
      organizationId:event.organizationId,
      handoffId,
      conversationId:event.conversationId,
      membershipId:assignment.membershipId,
      customerName:String(customer?.full_name||customer?.company_name||"Customer"),
      stageName,
      summary,
      nextAction,
      notifyWhatsApp:assignment.notifyWhatsApp,
      notifyDashboard:assignment.notifyDashboard,
    }).catch(()=>undefined);
    await admin.from("human_handoffs").update({notified_at:new Date().toISOString()})
      .eq("organization_id",event.organizationId).eq("id",handoffId);
  }

  return {
    handoffId,
    status:assignment.membershipId?"assigned":"open",
    assignedMembershipId:assignment.membershipId,
    stageId,
    stageName,
    summary,
    nextAction,
    structured,
    duplicate:false,
  };
}
