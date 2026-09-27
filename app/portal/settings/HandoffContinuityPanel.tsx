"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Member={id:string;email?:string|null;role:string;status:string};
type Preference={membership_id:string;whatsapp_phone?:string|null;notify_whatsapp_handoffs:boolean};
type Rule={id:string;name:string;category?:string|null;assigned_membership_id:string;priority:number;notify_whatsapp:boolean;status:string};

export default function HandoffContinuityPanel({members,preferences,rules,canManage}:{
  members:Member[];preferences:Preference[];rules:Rule[];canManage:boolean;
}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function post(payload:Record<string,unknown>){
    setBusy(true);setMessage("");
    try{
      const res=await fetch("/api/portal/settings/handoffs",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to save handoff settings");
      setMessage("Handoff settings saved.");
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to save handoff settings");}
    finally{setBusy(false);}
  }

  function prefFor(id:string){return preferences.find((item)=>item.membership_id===id);}

  async function saveMember(event:FormEvent<HTMLFormElement>,membershipId:string){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    await post({
      action:"save_member_preference",
      membershipId,
      whatsappPhone:String(form.get("whatsappPhone")||""),
      notifyWhatsAppHandoffs:form.get("notifyWhatsAppHandoffs")==="on",
    });
  }

  async function saveRule(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    await post({
      action:"save_rule",
      name:String(form.get("name")||""),
      category:String(form.get("category")||""),
      membershipId:String(form.get("membershipId")||""),
      priority:Number(form.get("priority")||100),
      notifyWhatsApp:form.get("notifyWhatsApp")==="on",
    });
    event.currentTarget.reset();
  }

  return <section className="portal-card">
    <div className="portal-card-head"><div>
      <h2>Handoff continuity</h2>
      <p>Choose who receives AI handoffs and where Fluxknight should notify them.</p>
    </div></div>

    <div className="portal-list">
      {members.filter((m)=>m.status==="active").map((member)=>{
        const pref=prefFor(member.id);
        return <form key={member.id} className="portal-list-row" onSubmit={(e)=>void saveMember(e,member.id)}>
          <div>
            <strong>{member.email||member.id}</strong>
            <span>{member.role} · WhatsApp notification contact</span>
          </div>
          <div className="portal-action-list" style={{minWidth:320}}>
            <input name="whatsappPhone" defaultValue={pref?.whatsapp_phone||""} placeholder="+234..." disabled={!canManage||busy} />
            <label><input name="notifyWhatsAppHandoffs" type="checkbox" defaultChecked={pref?.notify_whatsapp_handoffs||false} disabled={!canManage||busy} /> WhatsApp alerts</label>
            {canManage?<button type="submit" disabled={busy}>Save</button>:null}
          </div>
        </form>;
      })}
    </div>

    <div className="portal-card-head" style={{marginTop:24}}><div>
      <h2>Assignment rules</h2>
      <p>Map handoff categories such as payment, negotiation or customer request to a human owner.</p>
    </div></div>

    <div className="portal-list">
      {rules.filter((rule)=>rule.status==="active").map((rule)=><div className="portal-list-row" key={rule.id}>
        <div><strong>{rule.name}</strong><span>{rule.category||"Any category"} · priority {rule.priority}</span></div>
        {canManage?<button type="button" disabled={busy} onClick={()=>void post({action:"delete_rule",id:rule.id})}>Disable</button>:null}
      </div>)}
      {!rules.filter((rule)=>rule.status==="active").length?<p className="portal-empty">No automatic handoff assignment rules yet.</p>:null}
    </div>

    {canManage?<form onSubmit={saveRule} className="portal-form-grid" style={{marginTop:18}}>
      <div className="portal-field"><label>Rule name</label><input name="name" placeholder="Payment issues to Newton" required /></div>
      <div className="portal-field"><label>Category</label><input name="category" placeholder="payment_issue" /></div>
      <div className="portal-field"><label>Assign to</label><select name="membershipId" required defaultValue="">
        <option value="" disabled>Select team member</option>
        {members.filter((m)=>m.status==="active").map((member)=><option key={member.id} value={member.id}>{member.email||member.id} · {member.role}</option>)}
      </select></div>
      <div className="portal-field"><label>Rule priority</label><input name="priority" type="number" defaultValue="100" /></div>
      <label><input name="notifyWhatsApp" type="checkbox" defaultChecked /> Notify assignee on WhatsApp</label>
      <div><button type="submit" disabled={busy}>{busy?"Saving...":"Add rule"}</button></div>
    </form>:null}

    <p className="portal-empty">WhatsApp staff alerts require an approved <strong>internal_handoff</strong> template. Dashboard handoff visibility remains available even if WhatsApp notification delivery fails.</p>
    {message?<p className="portal-empty">{message}</p>:null}
  </section>;
}
