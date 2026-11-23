"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
type Category={id:string;name:string};
type Contact={id:string;email:string;full_name:string|null;eligible:boolean;reason:string};
type Audience={total:number;eligible:number;suppressed:number;unverified:number;reserved?:number;invalid?:number;truncated:boolean;contacts:Contact[]};
type Campaign={id:string;from_email:string;subject:string;text_body:string;status:string;category_id:string|null};
type Settings={enabled:boolean;daily_limit:number;manual_daily_limit:number;worker_verified:boolean};
export default function GencouvBulkCampaigns(){
  const [categories,setCategories]=useState<Category[]>([]),[campaigns,setCampaigns]=useState<Campaign[]>([]),[settings,setSettings]=useState<Settings|null>(null);
  const [campaignId,setCampaignId]=useState(""),[category,setCategory]=useState(""),[audience,setAudience]=useState<Audience|null>(null),[selected,setSelected]=useState<string[]>([]);
  const [from,setFrom]=useState("info@gencouv.com"),[subject,setSubject]=useState(""),[message,setMessage]=useState("");
  const [confirmed,setConfirmed]=useState(false),[consentConfirmed,setConsentConfirmed]=useState(false),[reviewed,setReviewed]=useState(false);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(""),[error,setError]=useState(""),[batch,setBatch]=useState<{batch_id:string;status:string}|null>(null);
  const requestId=useRef<string|null>(null),submissionLock=useRef(false);
  const resetReview=()=>{setConfirmed(false);setReviewed(false);setBatch(null);requestId.current=null;};
  const refresh=useCallback(async()=>{
    const resources=await Promise.allSettled(["outbound-settings","categories","campaigns"].map(async name=>{const response=await fetch(`/api/dashboard/gencouv/${name}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||`${name} unavailable.`);return data;}));
    const [state,groups,drafts]=resources;
    if(state.status==="fulfilled")setSettings(state.value);else{setSettings(null);setError("Automation settings unavailable. Manual sending remains independent.");}
    if(groups.status==="fulfilled")setCategories(groups.value.categories||[]);else setError("Categories unavailable. Retry before selecting an audience.");
    if(drafts.status==="fulfilled")setCampaigns(drafts.value.campaigns||[]);else setError("Campaign drafts unavailable. Retry before sending.");
  },[]);
  useEffect(()=>{const timer=setTimeout(()=>void refresh(),0);return()=>clearTimeout(timer);},[refresh]);
  async function toggle(enabled:boolean){
    setBusy(true);setError("");setStatus("");
    try{const response=await fetch("/api/dashboard/gencouv/outbound-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled,confirmed:true})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Campaign state could not be saved.");setSettings(data);setStatus(data.note);}catch(error){setError(error instanceof Error?error.message:"Campaign settings unavailable.");}finally{setBusy(false);}
  }
  function chooseCampaign(id:string){
    setCampaignId(id);setSelected([]);setAudience(null);resetReview();setStatus("");
    const draft=campaigns.find(item=>item.id===id);setFrom(draft?.from_email||"info@gencouv.com");setSubject(draft?.subject||"");setMessage(draft?.text_body||"");setCategory(draft?.category_id||"");
  }
  async function saveDraft(){
    setBusy(true);setError("");
    try{const response=await fetch("/api/dashboard/gencouv/campaigns",{method:campaignId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:campaignId||undefined,from,subject,text:message,category_id:category})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Draft could not be saved.");setCampaignId(data.campaign.id);setStatus(data.note);resetReview();await refresh();}catch(error){setError(error instanceof Error?error.message:"Draft could not be saved.");}finally{setBusy(false);}
  }
  async function preview(){
    setBusy(true);setError("");setSelected([]);setAudience(null);resetReview();
    try{const params=new URLSearchParams({category_id:category,campaign_id:campaignId});const response=await fetch(`/api/dashboard/gencouv/campaign-audience?${params}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Audience preview unavailable.");setAudience(data);}catch(error){setError(error instanceof Error?error.message:"Audience preview unavailable.");}finally{setBusy(false);}
  }
  async function send(){
    if(submissionLock.current)return;submissionLock.current=true;setBusy(true);setError("");setStatus("");
    requestId.current ||= crypto.randomUUID();
    try{const response=await fetch("/api/dashboard/gencouv/bulk-send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_id:requestId.current,mode:"one_time",campaign_id:campaignId,category_id:category,contact_ids:selected,from,subject,text:message,confirmed,consent_confirmed:consentConfirmed})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Send request was not confirmed. Retry the same request to retrieve its saved result.");setBatch(data);setStatus(`${data.note} Batch: ${data.batch_id}`);setConfirmed(false);await refresh();}catch(error){setError(error instanceof Error?error.message:"Outcome not confirmed. Retry this same saved request before composing another send.");}finally{submissionLock.current=false;setBusy(false);}
  }
  const saved=campaigns.find(item=>item.id===campaignId),dirty=Boolean(saved&&(saved.subject!==subject||saved.text_body!==message||saved.from_email!==from||(saved.category_id||"")!==category)),locked=Boolean(batch||saved&&saved.status!=="draft");
  return <section className="admin-panel gencouv-bulk-workspace" id="bulk-campaigns">
    <div className="admin-panel-header"><div><h2>Campaign management & manual bulk sending</h2><p>Save a draft, review eligible recipients, then authorize one batch of up to 100 contacts.</p></div><Link href="/dashboard/gencouv/contacts">Import contacts</Link></div>
    <section className="gencouv-automation-status" aria-label="Automated campaign controls">
      <div><strong>Automated campaigns: {settings?settings.enabled?"ON":"OFF":"Unavailable"}</strong><p>Manual emails remain available when automation is OFF. Manual daily limit (UTC): {settings?.manual_daily_limit??"unavailable"}.</p>{settings&&!settings.worker_verified?<p>Automation cannot be enabled until the connected worker’s permission, suppression and pause checks are verified.</p>:null}</div>
      <button disabled={busy||!settings||settings.enabled||!settings.worker_verified} onClick={()=>void toggle(true)}>Turn automation ON</button><button disabled={busy||!settings||!settings.enabled} onClick={()=>void toggle(false)}>Turn automation OFF</button><button disabled={busy} onClick={()=>void refresh()}>Refresh settings</button>
    </section>
    <label className="admin-field">Saved campaign<select value={campaignId} disabled={busy} onChange={event=>chooseCampaign(event.target.value)}><option value="">New campaign</option>{campaigns.map(campaign=><option key={campaign.id} value={campaign.id}>{campaign.subject} · {campaign.status}</option>)}</select></label>
    <div className="gencouv-campaign-form">
      <label className="admin-field">Sender<select disabled={busy||locked} value={from} onChange={event=>{setFrom(event.target.value);resetReview();}}>{["info@gencouv.com","support@gencouv.com","onboarding@gencouv.com"].map(sender=><option key={sender}>{sender}</option>)}</select></label>
      <label className="admin-field">Recipient category<select aria-label="Recipient category" disabled={busy||locked} value={category} onChange={event=>{setCategory(event.target.value);setAudience(null);setSelected([]);resetReview();}}><option value="">All saved contacts</option>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="admin-field gencouv-wide">Campaign subject<input disabled={busy||locked} value={subject} maxLength={200} onChange={event=>{setSubject(event.target.value);resetReview();}}/></label>
      <label className="admin-field gencouv-wide">Campaign message<textarea aria-label="Campaign message" disabled={busy||locked} value={message} rows={8} maxLength={30000} onChange={event=>{setMessage(event.target.value);resetReview();}}/><small>Use [Name] for the recipient’s saved name. An unsubscribe link is included automatically.</small></label>
    </div>
    <div className="gencouv-action-row"><button disabled={busy||locked||!subject.trim()||!message.trim()} onClick={()=>void saveDraft()}>Save campaign draft</button><button disabled={busy||!campaignId||dirty} onClick={()=>void preview()}>Preview eligible audience</button><button disabled={busy||!subject.trim()||!message.trim()} onClick={()=>setReviewed(true)}>Preview message</button></div>
    {locked?<p>This campaign’s content is locked after its first reservation. Previously reserved recipients are excluded from subsequent batches. Choose New campaign for different content.</p>:null}
    {reviewed?<section className="gencouv-message-preview" aria-label="Campaign message preview"><h3>{subject}</h3><p>{message}</p><small>Names are personalized for each selected contact. Unsubscribe is included on every marketing email.</small></section>:null}
    {audience?<div className="gencouv-audience" aria-label="Eligible recipient selection"><p>{audience.total} reviewed · {audience.eligible} eligible · {audience.unverified} permission unverified · {audience.suppressed} suppressed · {audience.reserved||0} already reserved · {audience.invalid||0} invalid addresses</p>{audience.truncated?<p role="status">Showing up to 500 contacts. Use a category to narrow this audience.</p>:null}
      <button disabled={busy||Boolean(batch)} onClick={()=>{setSelected(audience.contacts.filter(contact=>contact.eligible).slice(0,100).map(contact=>contact.id));setConfirmed(false);requestId.current=null;}}>Select up to 100 eligible contacts</button>
      <div className="gencouv-recipient-list">{audience.contacts.map(contact=><label key={contact.id}><input type="checkbox" checked={selected.includes(contact.id)} disabled={busy||Boolean(batch)||!contact.eligible||selected.length>=100&&!selected.includes(contact.id)} onChange={event=>{setSelected(current=>event.target.checked?[...current,contact.id]:current.filter(id=>id!==contact.id));setConfirmed(false);requestId.current=null;}}/><span><strong>{contact.full_name||"Unnamed contact"}</strong><span>{contact.email}</span><small>{contact.reason.replaceAll("_"," ")}</small></span></label>)}</div>
    </div>:null}
    <p>{selected.length} recipients selected. Saving a draft or previewing an audience does not enroll or send email.</p>
    <label className="gencouv-confirmation"><input type="checkbox" disabled={busy||Boolean(batch)} checked={consentConfirmed} onChange={event=>setConsentConfirmed(event.target.checked)}/>I confirm these recipients already gave permission for this Gencouv campaign. This does not create consent for unverified or publicly collected contacts.</label>
    <label className="gencouv-confirmation"><input type="checkbox" disabled={busy||Boolean(batch)} checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I reviewed the recipients, sender, subject and message and authorize this one-time batch.</label>
    <button className="gencouv-primary" disabled={busy||Boolean(batch)||dirty||!campaignId||!reviewed||!selected.length||!confirmed||!consentConfirmed} onClick={()=>void send()}>{busy?"Processing…":`Send one-time email to ${selected.length} recipient${selected.length===1?"":"s"}`}</button>
    {batch?<p><Link href="#email-history">Review this batch in Email history</Link>. No further send was scheduled.</p>:null}
    {batch&&["failed","cancelled"].includes(batch.status)?<button disabled={busy} onClick={()=>{resetReview();setStatus("Review and explicitly confirm a new attempt after correcting the rejection.");}}>Prepare a new reviewed attempt</button>:null}
    {error?<p role="alert">{error}</p>:null}{status?<p role={batch&&["unknown","partial","submitting","failed","cancelled"].includes(batch.status)?"alert":"status"}>{status}</p>:null}
  </section>;
}
