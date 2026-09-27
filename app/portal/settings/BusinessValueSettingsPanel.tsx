"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Settings={
  enabled:boolean;
  currency?:string|null;
  human_hourly_value?:number|null;
  minutes_per_ai_handled_conversation?:number|null;
  minutes_per_follow_up?:number|null;
  minutes_per_appointment?:number|null;
  minutes_per_handoff_triage?:number|null;
};

export default function BusinessValueSettingsPanel({settings,canManage}:{settings:Settings|null;canManage:boolean}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!canManage) return;
    setBusy(true);setMessage("");
    const form=new FormData(event.currentTarget);
    const payload={
      enabled:form.get("enabled")==="on",
      currency:String(form.get("currency")||""),
      humanHourlyValue:String(form.get("humanHourlyValue")||""),
      minutesPerAiHandledConversation:String(form.get("minutesPerAiHandledConversation")||""),
      minutesPerFollowUp:String(form.get("minutesPerFollowUp")||""),
      minutesPerAppointment:String(form.get("minutesPerAppointment")||""),
      minutesPerHandoffTriage:String(form.get("minutesPerHandoffTriage")||""),
    };
    try{
      const res=await fetch("/api/portal/settings/business-value",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to save assumptions");
      setMessage("Business-value assumptions saved.");
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to save assumptions");}
    finally{setBusy(false);}
  }

  return <section className="portal-card">
    <div className="portal-card-head"><div>
      <h2>Business-value assumptions</h2>
      <p>Optional organization-specific assumptions used for time/value estimates. They never change operational counts.</p>
    </div></div>
    <form className="portal-form-grid" onSubmit={submit}>
      <label><input name="enabled" type="checkbox" defaultChecked={settings?.enabled||false} disabled={!canManage||busy} /> Enable estimated time/value reporting</label>
      <div className="portal-field"><label>Currency</label><input name="currency" defaultValue={settings?.currency||""} placeholder="NGN" disabled={!canManage||busy} /></div>
      <div className="portal-field"><label>Human hourly value</label><input name="humanHourlyValue" type="number" min="0" step="0.01" defaultValue={settings?.human_hourly_value??""} disabled={!canManage||busy} /></div>
      <div className="portal-field"><label>Minutes saved per AI-handled conversation</label><input name="minutesPerAiHandledConversation" type="number" min="0" step="0.1" defaultValue={settings?.minutes_per_ai_handled_conversation??""} disabled={!canManage||busy} /></div>
      <div className="portal-field"><label>Minutes saved per completed follow-up</label><input name="minutesPerFollowUp" type="number" min="0" step="0.1" defaultValue={settings?.minutes_per_follow_up??""} disabled={!canManage||busy} /></div>
      <div className="portal-field"><label>Minutes saved per confirmed appointment</label><input name="minutesPerAppointment" type="number" min="0" step="0.1" defaultValue={settings?.minutes_per_appointment??""} disabled={!canManage||busy} /></div>
      <div className="portal-field"><label>Minutes saved per handoff triage</label><input name="minutesPerHandoffTriage" type="number" min="0" step="0.1" defaultValue={settings?.minutes_per_handoff_triage??""} disabled={!canManage||busy} /></div>
      {canManage?<div><button type="submit" disabled={busy}>{busy?"Saving...":"Save assumptions"}</button></div>:null}
    </form>
    <p className="portal-empty">Revenue and ROI are not inferred from these settings. Estimated value is only time saved × your configured hourly value.</p>
    {message?<p className="portal-empty">{message}</p>:null}
  </section>;
}
