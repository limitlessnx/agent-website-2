"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./HumanOperationsPanel.module.css";

type Handoff={
  id:string;conversation_id:string;reason:string;category:string;priority:string;status:string;
  assigned_membership_id?:string|null;claimed_by_membership_id?:string|null;sla_due_at?:string|null;created_at:string;
  conversation_summary?:string|null;stage_name?:string|null;next_action?:string|null;outcome?:string|null;
  follow_up_required?:boolean;follow_up_due_at?:string|null;follow_up_status?:string|null;assigned_to_email?:string|null;
  customer_name?:string|null;
  metadata?:Record<string,unknown>|null;
  whatsapp_notification_status?:string|null; whatsapp_notification_error?:string|null; whatsapp_notification_error_code?:string|null;
  whatsapp_notification_id?:string|null; whatsapp_notification_retry_count?:number;
  whatsapp_notification_fallback_attempted?:boolean;
};
type Approval={
  id:string;approval_type:string;title:string;description?:string|null;risk_level:string;status:string;
  action_key:string;requested_at:string;expires_at?:string|null;requested_by_type:string;requested_by_id?:string|null;
};
type Member={id:string;email?:string|null;role:string;status:string};

export default function HumanOperationsPanel({
  handoffs,approvals,members,permissions,membershipId,canRetryHandoffNotifications,
}:{
  handoffs:Handoff[];approvals:Approval[];members:Member[];permissions:string[];membershipId:string;canRetryHandoffNotifications:boolean;
}){
  const router=useRouter();
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [retryPreview,setRetryPreview]=useState<{handoffId:string;notificationId:string;approvalId:string;recipientPreview:string;message:string;expiresAt:string}|null>(null);
  const canManageHandoffs=permissions.includes("handoffs.manage");
  const canManageApprovals=permissions.includes("approvals.manage");
  const listValue=(value:unknown)=>Array.isArray(value)?value.filter((item)=>typeof item==="string"&&item.trim()).map(String):[];

  async function post(url:string,body:Record<string,unknown>,key:string){
    setBusy(key);setError(null);
    try{
      const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const payload=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(String(payload.error||"Action failed"));
      router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Action failed");}
    finally{setBusy(null);}
  }

  async function prepareNotificationRetry(item:Handoff){
    if(!item.whatsapp_notification_id)return;
    setBusy(item.id+":retry-prepare");setError(null);
    try{
      const res=await fetch(`/api/portal/handoffs/${item.id}/retry`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"prepare",notificationId:item.whatsapp_notification_id})});
      const payload=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(String(payload.error||"Could not prepare notification retry"));
      setRetryPreview({handoffId:item.id,notificationId:item.whatsapp_notification_id,approvalId:String(payload.preview?.approvalId||""),recipientPreview:String(payload.preview?.recipientPreview||""),message:String(payload.preview?.message||""),expiresAt:String(payload.preview?.expiresAt||"")});
    }catch(err){setError(err instanceof Error?err.message:"Could not prepare notification retry");}
    finally{setBusy(null);}
  }

  async function confirmNotificationRetry(){
    const prepared=retryPreview;if(!prepared)return;
    setBusy(prepared.handoffId+":retry-confirm");setError(null);
    try{
      const res=await fetch(`/api/portal/handoffs/${prepared.handoffId}/retry`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"confirm",notificationId:prepared.notificationId,approvalId:prepared.approvalId})});
      const payload=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(String(payload.error||"Could not retry notification"));
      if(payload.result?.status==="unknown")setError("Provider acceptance is uncertain. Verify delivery manually; do not retry this notification.");
      else if(payload.result?.status==="failed")setError(String(payload.result?.errorMessage||"The provider definitively rejected the retry."));
      setRetryPreview(null);router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Could not retry notification");}
    finally{setBusy(null);}
  }

  return <section className="portal-card">
    <div className="portal-card-head"><div>
      <p className="portal-kicker">Human operations</p>
      <h2>Handoffs & approvals</h2>
      <p>Customer work waiting on a person, plus sensitive actions waiting for approval.</p>
    </div></div>

    {error?<p className="portal-empty">{error}</p>:null}

    <div className={styles.handoffList}>
      {handoffs.map((item)=>{
        const structured=item.metadata&&typeof item.metadata.structured_handoff==="object"&&!Array.isArray(item.metadata.structured_handoff)
          ? item.metadata.structured_handoff as Record<string,unknown>
          : {};
        const keyPoints=listValue(structured.keyPoints);
        const questions=listValue(structured.customerQuestions);
        return <article className={styles.handoffCard} key={item.id}>
        <div>
          <strong>{item.customer_name||"Customer"} · {item.priority.toUpperCase()}</strong>
          <span>{item.stage_name||"Stage not set"} · {item.category.replaceAll("_"," ")} · {item.status.replaceAll("_"," ")}</span>
          <span><strong>Current request:</strong> {String(structured.customerIntent||item.reason||"Human assistance requested")}</span>
          {structured.property||structured.propertyInterest?<span><strong>Property:</strong> {String(structured.property||structured.propertyInterest)}</span>:null}
          {item.conversation_summary?<span><strong>Summary:</strong> {item.conversation_summary}</span>:null}
          {keyPoints.length?<span><strong>Key points:</strong> {keyPoints.join(" · ")}</span>:null}
          {questions.length?<span><strong>Customer questions:</strong> {questions.join(" · ")}</span>:null}
          {item.next_action?<span><strong>Next action:</strong> {item.next_action}</span>:null}
          {item.assigned_to_email?<span><strong>Assigned to:</strong> {item.assigned_to_email}</span>:null}
          <span><strong>WhatsApp handover:</strong> {item.whatsapp_notification_status?item.whatsapp_notification_status.replaceAll("_"," "):"Not attempted"}{item.whatsapp_notification_error?" · "+item.whatsapp_notification_error:""}</span>
          <small>
            {item.sla_due_at?"SLA due "+new Date(item.sla_due_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"No SLA"}
            {item.follow_up_status?" · follow-up "+item.follow_up_status.replaceAll("_"," "):""}
          </small>
        </div>
        <div className={styles.actions}>
          <Link href={"/portal/conversations/"+item.conversation_id}>Open conversation</Link>
          {!item.claimed_by_membership_id?
            <button type="button" disabled={busy===item.id+":claim"} onClick={()=>post(`/api/portal/handoffs/${item.id}`,{action:"claim"},item.id+":claim")}>Claim</button>:null}
          {canManageHandoffs?<select
            value={item.assigned_membership_id||""}
            disabled={busy===item.id+":assign"}
            onChange={(e)=>e.target.value&&post(`/api/portal/handoffs/${item.id}`,{action:"assign",membershipId:e.target.value},item.id+":assign")}
          >
            <option value="">Assign to...</option>
            {members.filter((m)=>m.status==="active").map((m)=><option key={m.id} value={m.id}>{m.email||m.id} · {m.role}</option>)}
          </select>:null}
          {(item.claimed_by_membership_id===membershipId||item.assigned_membership_id===membershipId||canManageHandoffs)?<>
            <button type="button" disabled={busy===item.id+":resolve"} onClick={()=>{
              const resolution=window.prompt("Resolution summary")||"Resolved by human";
              const outcome=window.prompt("Outcome for this customer")||resolution;
              const nextAction=window.prompt("Next action, if any")||"";
              const followUp=window.confirm("Should Fluxknight check in with this customer after the handoff?");
              void post("/api/portal/handoffs/"+item.id,{
                action:"resolve",resolution,outcome,nextAction,resumeAi:true,
                followUpRequired:followUp,followUpMinutes:720,
              },item.id+":resolve");
            }}>Resolve & resume AI</button>
            <button type="button" disabled={busy===item.id+":stop"} onClick={()=>{
              const resolution=window.prompt("Resolution summary")||"Resolved by human";
              const outcome=window.prompt("Outcome for this customer")||resolution;
              void post("/api/portal/handoffs/"+item.id,{
                action:"resolve",resolution,outcome,resumeAi:false,followUpRequired:false,
              },item.id+":stop");
            }}>Resolve & keep AI off</button>
          </>:null}
          {canRetryHandoffNotifications&&canManageHandoffs&&item.whatsapp_notification_status==="failed"&&!item.whatsapp_notification_fallback_attempted&&item.whatsapp_notification_error_code&&item.whatsapp_notification_error_code!=="131047"&&item.whatsapp_notification_id&&Number(item.whatsapp_notification_retry_count||0)<3?
            <button type="button" disabled={busy===item.id+":retry-prepare"||busy===item.id+":retry-confirm"} onClick={()=>void prepareNotificationRetry(item)}>{busy===item.id+":retry-prepare"?"Preparing…":"Prepare staff notification retry"}</button>:null}
          {canRetryHandoffNotifications&&canManageHandoffs&&item.whatsapp_notification_status==="failed"&&item.whatsapp_notification_fallback_attempted?<small>The approved service-window template fallback was already attempted; verify delivery manually.</small>:null}
          {canRetryHandoffNotifications&&canManageHandoffs&&item.whatsapp_notification_status==="failed"&&item.whatsapp_notification_error_code==="131047"&&!item.whatsapp_notification_fallback_attempted?<small>The provider closed the 24-hour text window. Do not retry a free-form message; use the approved staff template fallback or verify it manually.</small>:null}
          {canRetryHandoffNotifications&&canManageHandoffs&&item.whatsapp_notification_status==="failed"&&Number(item.whatsapp_notification_retry_count||0)>=3?<small>Retry limit reached; verify the staff notification manually.</small>:null}
        </div>
        {retryPreview?.handoffId===item.id?<div role="group" aria-label="Exact staff notification retry preview" className={styles.retryPreview}>
          <strong>Review before sending</strong>
          <span>This sends only to staff, not to the customer. Recipient: {retryPreview.recipientPreview}. Approval expires {new Date(retryPreview.expiresAt).toLocaleTimeString()}.</span>
          <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{retryPreview.message}</pre>
          <button type="button" disabled={busy===item.id+":retry-confirm"} onClick={()=>void confirmNotificationRetry()}>{busy===item.id+":retry-confirm"?"Sending…":"Confirm and resend to staff"}</button>
          <button type="button" disabled={busy===item.id+":retry-confirm"} onClick={()=>setRetryPreview(null)}>Cancel</button>
        </div>:null}
      </article>})}
      {!handoffs.length?<p className="portal-empty">No active human handoffs.</p>:null}
    </div>

    <div className="portal-card-head" style={{marginTop:24}}><div><h2>Pending approvals</h2><p>Actions that require a human decision before execution.</p></div></div>
    <div className="portal-list">
      {approvals.map((item)=><div className="portal-list-row" key={item.id}>
        <div>
          <strong>{item.risk_level.toUpperCase()} · {item.title}</strong>
          <span>{item.description||item.action_key}</span>
          <small>Requested {new Date(item.requested_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</small>
        </div>
        {canManageApprovals?<div className={styles.actions}>
          <button type="button" disabled={busy===item.id+":approve"} onClick={()=>post(`/api/portal/approvals/${item.id}`,{decision:"approved",reason:"Approved from tenant operations queue"},item.id+":approve")}>Approve</button>
          <button type="button" disabled={busy===item.id+":reject"} onClick={()=>post(`/api/portal/approvals/${item.id}`,{decision:"rejected",reason:"Rejected from tenant operations queue"},item.id+":reject")}>Reject</button>
        </div>:null}
      </div>)}
      {!approvals.length?<p className="portal-empty">No pending approvals.</p>:null}
    </div>
  </section>;
}
