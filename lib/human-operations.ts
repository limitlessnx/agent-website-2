import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationAccessContext, assertAnyOrganizationPermission, listOrganizationMembers } from "@/lib/organization-membership";
import type { ClientSession } from "@/lib/client-auth";

export type HumanHandoffRow={
  id:string; customer_id:string; conversation_id:string; reason:string; category:string; priority:string; status:string;
  assigned_membership_id?:string|null; claimed_by_membership_id?:string|null; sla_due_at?:string|null;
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
      ? admin.from("human_handoffs").select("id,customer_id,conversation_id,reason,category,priority,status,assigned_membership_id,claimed_by_membership_id,sla_due_at,created_at,updated_at,resolution_summary").eq("organization_id",session.organizationId).not("status","in",'(resolved,closed)').order("created_at",{ascending:false}).limit(100)
      : Promise.resolve({data:[],error:null}),
    canApprovals
      ? admin.from("operation_approvals").select("id,approval_type,title,description,risk_level,status,requested_by_type,requested_by_id,subject_type,subject_id,action_key,preview,assigned_membership_id,requested_at,expires_at,decided_at").eq("organization_id",session.organizationId).eq("status","pending").order("requested_at",{ascending:false}).limit(100)
      : Promise.resolve({data:[],error:null}),
    canHandoffs ? listOrganizationMembers(session.organizationId,session.userId).catch(()=>[]) : Promise.resolve([]),
  ]);
  if(handoffsResult.error) throw handoffsResult.error;
  if(approvalsResult.error) throw approvalsResult.error;
  return {
    handoffs:(handoffsResult.data||[]) as HumanHandoffRow[],
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
  return data;
}

export async function resolveHumanHandoff(session:ClientSession,handoffId:string,resolution:string,resumeAi:boolean){
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  const admin=createAdminClient();
  const {data:handoff,error}=await admin.from("human_handoffs").select("*").eq("organization_id",session.organizationId).eq("id",handoffId).maybeSingle();
  if(error) throw error;
  if(!handoff) throw new Error("Handoff not found.");
  const owns=handoff.assigned_membership_id===access.membershipId||handoff.claimed_by_membership_id===access.membershipId;
  if(!owns&&!access.permissions.has("handoffs.manage")) throw new Error("Only the assignee, claimant, or handoff manager can resolve this handoff.");
  const now=new Date().toISOString();
  const {data,error:updateError}=await admin.from("human_handoffs").update({
    status:"resolved",resolved_at:now,resolution_summary:resolution.trim()||null,updated_at:now,
  }).eq("organization_id",session.organizationId).eq("id",handoffId).select().single();
  if(updateError) throw updateError;

  const {data:conversation}=await admin.from("crm_conversations").select("metadata").eq("organization_id",session.organizationId).eq("id",handoff.conversation_id).maybeSingle();
  const metadata={...((conversation?.metadata||{}) as Record<string,unknown>)};
  delete metadata.active_handoff_id;
  Object.assign(metadata,{ai_response_mode:resumeAi?"active":"stopped",last_resolved_handoff_id:handoffId});
  await admin.from("crm_conversations").update({
    status:resumeAi?"ai_active":"resolved",metadata,updated_at:now,
  }).eq("organization_id",session.organizationId).eq("id",handoff.conversation_id);

  await (admin as any).rpc("add_customer_timeline_event",{
    p_organization_id:session.organizationId,p_customer_id:handoff.customer_id,
    p_event_type:"handoff.resolved",p_title:"Human handoff resolved",p_summary:resolution.trim()||null,
    p_channel:"internal",p_conversation_id:handoff.conversation_id,p_source_table:"human_handoffs",p_source_id:handoffId,
    p_correlation_id:handoff.correlation_id||null,p_actor_type:"human",p_actor_id:access.membershipId,
    p_metadata:{resume_ai:resumeAi},p_occurred_at:now,
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
