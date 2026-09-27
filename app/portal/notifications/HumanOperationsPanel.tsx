"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Handoff={
  id:string;reason:string;category:string;priority:string;status:string;
  assigned_membership_id?:string|null;claimed_by_membership_id?:string|null;sla_due_at?:string|null;created_at:string;
};
type Approval={
  id:string;approval_type:string;title:string;description?:string|null;risk_level:string;status:string;
  action_key:string;requested_at:string;expires_at?:string|null;requested_by_type:string;requested_by_id?:string|null;
};
type Member={id:string;email?:string|null;role:string;status:string};

export default function HumanOperationsPanel({
  handoffs,approvals,members,permissions,membershipId,
}:{
  handoffs:Handoff[];approvals:Approval[];members:Member[];permissions:string[];membershipId:string;
}){
  const router=useRouter();
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const canManageHandoffs=permissions.includes("handoffs.manage");
  const canManageApprovals=permissions.includes("approvals.manage");

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

  return <section className="portal-card">
    <div className="portal-card-head"><div>
      <p className="portal-kicker">Human operations</p>
      <h2>Handoffs & approvals</h2>
      <p>Customer work waiting on a person, plus sensitive actions waiting for approval.</p>
    </div></div>

    {error?<p className="portal-empty">{error}</p>:null}

    <div className="portal-list">
      {handoffs.map((item)=><div className="portal-list-row" key={item.id}>
        <div>
          <strong>{item.priority.toUpperCase()} · {item.category.replaceAll("_"," ")}</strong>
          <span>{item.reason} · {item.status.replaceAll("_"," ")}</span>
          {item.sla_due_at?<small>SLA due {new Date(item.sla_due_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</small>:null}
        </div>
        <div className="portal-action-list" style={{minWidth:240}}>
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
          {(item.claimed_by_membership_id===membershipId||item.assigned_membership_id===membershipId||canManageHandoffs)?
            <button type="button" disabled={busy===item.id+":resolve"} onClick={()=>{
              const resolution=window.prompt("Resolution summary")||"Resolved by human";
              void post(`/api/portal/handoffs/${item.id}`,{action:"resolve",resolution,resumeAi:true},item.id+":resolve");
            }}>Resolve & resume AI</button>:null}
        </div>
      </div>)}
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
        {canManageApprovals?<div className="portal-action-list" style={{minWidth:220}}>
          <button type="button" disabled={busy===item.id+":approve"} onClick={()=>post(`/api/portal/approvals/${item.id}`,{decision:"approved",reason:"Approved from tenant operations queue"},item.id+":approve")}>Approve</button>
          <button type="button" disabled={busy===item.id+":reject"} onClick={()=>post(`/api/portal/approvals/${item.id}`,{decision:"rejected",reason:"Rejected from tenant operations queue"},item.id+":reject")}>Reject</button>
        </div>:null}
      </div>)}
      {!approvals.length?<p className="portal-empty">No pending approvals.</p>:null}
    </div>
  </section>;
}
