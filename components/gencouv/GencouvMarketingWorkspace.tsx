"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Category = {id:string;name:string};
type Lead = {id:string;full_name:string|null;email:string;eligible:boolean;reason:string};
type Audience = {total:number;eligible:number;unverified:number;suppressed:number;truncated:boolean;contacts:Lead[]};
const templates = {
  blank: {subject:"",text:""},
  copy: {subject:"Gencouv Capital copy trading information",text:"Hello [Name],\n\nThank you for your interest in Gencouv Capital. I am reaching out to share information about our copy trading offering and how onboarding works.\n\nBest regards,\nGencouv Capital"},
  portfolio: {subject:"Gencouv Capital portfolio management enquiry",text:"Hello [Name],\n\nThank you for your interest in Gencouv Capital. I would be happy to share our portfolio management process and discuss whether it fits your objectives.\n\nBest regards,\nGencouv Capital"}
} as const;
export default function GencouvMarketingWorkspace(){
  const [categories,setCategories] = useState<Category[]>([]);
  const [category,setCategory] = useState("");
  const [audience,setAudience] = useState<Audience|null>(null);
  const [from,setFrom] = useState("info@gencouv.com");
  const [to,setTo] = useState("");
  const [subject,setSubject] = useState("");
  const [message,setMessage] = useState("");
  const [confirmed,setConfirmed] = useState(false);
  const [sending,setSending] = useState(false);
  const [busy,setBusy] = useState(false);
  const [feedback,setFeedback] = useState("");
  const [error,setError] = useState("");
  useEffect(()=>{void fetch("/api/dashboard/gencouv/categories",{cache:"no-store"}).then(r=>r.json()).then(x=>setCategories(x.categories||[])).catch(()=>setError("Unable to load categories."));},[]);
  const load = useCallback(async()=>{
    setBusy(true);setError("");setFeedback("");
    try {
      const response=await fetch("/api/dashboard/gencouv/campaign-audience?category_id="+encodeURIComponent(category),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Audience preview failed.");
      setAudience(data);
    }catch(e){setError(e instanceof Error?e.message:"Audience preview failed.");}
    finally{setBusy(false);}
  },[category]);
  async function send(){
    setSending(true);setError("");setFeedback("");
    try{
      const response=await fetch("/api/dashboard/gencouv/proposals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from,to,subject,text:message,confirmed})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Email was not sent.");
      setFeedback(data.note||"Email accepted.");
      setConfirmed(false);setTo("");setSubject("");setMessage("");
    }catch(e){setError(e instanceof Error?e.message:"Email sending failed.");}
    finally{setSending(false);}
  }
  return <div style={{display:"grid",gap:18,maxWidth:1060,margin:"0 auto"}}>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Marketing audiences</h2><p>Preview contact categories, verified consent and suppression safeguards before planning a campaign.</p></div><span className="admin-status">Preview only</span></div>
      <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap"}}>
        <label className="admin-field" style={{minWidth:220,flex:1}}>Audience category
          <select value={category} onChange={e=>{setCategory(e.target.value);setAudience(null);}}>
            <option value="">All saved Gencouv contacts</option>
            {categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={()=>void load()}>{busy?"Loading…":"Preview audience"}</button>
      </div>
      {audience && <div style={{marginTop:18}}>
        <div className="admin-checklist">
          <span>{audience.total} contacts reviewed</span>
          <span>{audience.eligible} consent eligible</span>
          <span>{audience.unverified} unverified</span>
          <span>{audience.suppressed} suppressed / blocked</span>
        </div>
        {audience.truncated && <p role="status">This preview is limited to 500 contacts; larger lists need pagination before sending is supported.</p>}
        <div style={{maxHeight:300,overflowY:"auto",marginTop:12}}>
          {audience.contacts.slice(0,100).map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",gap:10,borderBottom:"1px solid var(--admin-border)",padding:"9px 0",flexWrap:"wrap"}}>
            <span style={{overflowWrap:"anywhere"}}>{c.full_name||"Unnamed"} · {c.email}</span><span className={c.eligible?"admin-status live":"admin-status"}>{c.reason.replaceAll("_"," ")}</span>
          </div>)}
        </div>
        <p>Contacts are not automatically enrolled in campaigns. Sending needs a separate reviewed, permission-based campaign workflow.</p>
      </div>}
      <p><Link href="/dashboard/gencouv/contacts">Import and view saved contacts</Link> · <Link href="/dashboard/gencouv/categories">Manage your categories</Link></p>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Compose an individual proposal</h2><p>Send a manually reviewed, one-recipient Gencouv email via Resend. This does not start a marketing campaign.</p></div><span className="admin-status">Resend</span></div>
      <div style={{display:"grid",gap:14}}>
        <label className="admin-field">From<select value={from} onChange={e=>{setFrom(e.target.value);setConfirmed(false);}}>
          <option value="info@gencouv.com">info@gencouv.com</option><option value="support@gencouv.com">support@gencouv.com</option><option value="onboarding@gencouv.com">onboarding@gencouv.com</option>
        </select></label>
        <label className="admin-field">Proposal template<select defaultValue="blank" onChange={e=>{const key=e.target.value as keyof typeof templates;setSubject(templates[key].subject);setMessage(templates[key].text);setConfirmed(false);}}>
          <option value="blank">Custom email</option><option value="copy">Copy trading</option><option value="portfolio">Portfolio management</option>
        </select></label>
        <label className="admin-field">Recipient<input type="email" value={to} maxLength={254} placeholder="client@example.com" onChange={e=>{setTo(e.target.value);setConfirmed(false);}}/></label>
        <label className="admin-field">Subject<input value={subject} maxLength={200} onChange={e=>{setSubject(e.target.value);setConfirmed(false);}}/></label>
        <label className="admin-field">Message<textarea value={message} rows={10} maxLength={30000} onChange={e=>{setMessage(e.target.value);setConfirmed(false);}}/></label>
        <label style={{display:"flex",gap:8,alignItems:"start"}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I have checked the recipient, replaced all placeholders, and reviewed this one-to-one email.</label>
        <button type="button" disabled={sending||!confirmed||!to||!subject.trim()||!message.trim()} onClick={()=>void send()}>{sending?"Sending…":"Send individual email"}</button>
      </div>
      {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}
      {feedback&&<p role="status">{feedback}</p>}
    </section>
  </div>;
}
