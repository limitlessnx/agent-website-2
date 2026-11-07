"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./EmailWorkspace.module.css";

type Mail = {id:string;from:string;to:string[];subject:string;created_at:string;text?:string;html?:string;last_event?:string};
type View = "inbox" | "sent" | "compose" | "drafts";
type Draft = {id:string;sender:string;recipient:string;subject:string;body:string;template:string;updated_at:string};
const SENDERS = ["limitless@fluxknight.space","info@fluxknight.space"];
const TEMPLATES: Record<string,{subject:string;text:string}> = {
  "blank":{subject:"",text:""},
  "hotel":{subject:"A more seamless guest experience for [Hotel Name]",text:`Hello [Name],

I'm reaching out from Fluxknight. We help hotels simplify guest inquiries, reservations, and service communication through a connected hospitality operating system.

We would like to propose a tailored setup for [Hotel Name], covering booking assistance, guest experience previews, service requests, and timely follow-ups.

I would welcome a short conversation to understand your current guest journey and share a proposal tailored to your property.

Best regards,
Fluxknight
fluxknight.space`},
  "real-estate":{subject:"Improving inquiry-to-inspection conversions at [Company]",text:`Hello [Name],

At Fluxknight, we help real estate teams respond to property inquiries on WhatsApp, capture interested prospects, organize inspections, and follow up with buyers consistently.

We would like to explore how a tailored AI concierge and connected CRM could support [Company]'s current sales workflow.

Would you be open to a brief discussion of the challenges your sales team currently faces?

Best regards,
Fluxknight
fluxknight.space`}
};
export default function EmailWorkspace() {
  const [view,setView] = useState<View>("inbox");
  const [sender,setSender] = useState(SENDERS[0]);
  const [rows,setRows] = useState<Mail[]>([]);
  const [selected,setSelected] = useState<Mail | null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [to,setTo] = useState("");
  const [subject,setSubject] = useState("");
  const [message,setMessage] = useState("");
  const [confirmed,setConfirmed] = useState(false);
  const [sending,setSending] = useState(false);
  const [attachment,setAttachment] = useState<File | null>(null);
  const [more,setMore] = useState(false);
  const [template,setTemplate] = useState("blank");
  const [drafts,setDrafts] = useState<Draft[]>([]);
  const [draftId,setDraftId] = useState<string|null>(null);
  const [saving,setSaving] = useState(false);
  const [search,setSearch] = useState("");
  const [cursor,setCursor] = useState<string|null>(null);
  const load = useCallback(async (append=false) => {
    setLoading(true);setError("");if(!append)setSelected(null);
    try {
      const response = await fetch("/api/dashboard/email?kind="+view+"&sender="+encodeURIComponent(sender)+(append&&cursor?"&after="+encodeURIComponent(cursor):""),{cache:"no-store"});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Unable to load messages.");
      setRows(previous=>append?[...previous,...(data.emails||[])]:data.emails||[]);setMore(Boolean(data.has_more));setCursor(data.next_cursor||null);
    } catch (caught) {setError(caught instanceof Error ? caught.message : "Unable to load mail.");}
    finally {setLoading(false);}
  },[view,sender,cursor]);
  useEffect(()=>{if(view==="inbox"||view==="sent"){setCursor(null);void load(false);}},[view,sender]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadDrafts = useCallback(async () => {
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/dashboard/email/drafts",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to load drafts.");
      setDrafts(data.drafts||[]);
    }catch(caught){setError(caught instanceof Error?caught.message:"Unable to load drafts.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{if(view==="drafts")void loadDrafts();},[view,loadDrafts]);
  async function saveDraft(){
    if(saving)return;
    setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/dashboard/email/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:draftId||undefined,sender,recipient:to,subject,body:message,template})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to save draft.");
      setDraftId(data.draft.id);setNotice("Draft saved securely. PDF attachments are not stored with drafts.");
    }catch(caught){setError(caught instanceof Error?caught.message:"Unable to save draft.");}
    finally{setSaving(false);}
  }
  async function removeDraft(id:string){
    if(!window.confirm("Delete this draft permanently?"))return;
    setError("");
    try{
      const response=await fetch("/api/dashboard/email/drafts",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to delete draft.");
      setDrafts(prev=>prev.filter(d=>d.id!==id));if(draftId===id)setDraftId(null);
    }catch(caught){setError(caught instanceof Error?caught.message:"Unable to delete draft.");}
  }
  function openDraft(draft:Draft){
    setDraftId(draft.id);setSender(draft.sender);setTo(draft.recipient);setSubject(draft.subject);setMessage(draft.body);setTemplate(draft.template);setAttachment(null);setConfirmed(false);setView("compose");
  }
  function newMessage(){
    setDraftId(null);setTo("");setSubject("");setMessage("");setTemplate("blank");setAttachment(null);setConfirmed(false);setSelected(null);setError("");setView("compose");
  }

  async function openMail(mail:Mail){
    setError("");
    try {
      const response = await fetch("/api/dashboard/email?kind="+view+"&sender="+encodeURIComponent(sender)+"&id="+encodeURIComponent(mail.id),{cache:"no-store"});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Unable to open message.");
      setSelected(data.email);
    } catch(caught){setError(caught instanceof Error ? caught.message : "Unable to open message.");}
  }
  function chooseTemplate(key:string){
    setTemplate(key);setSubject(TEMPLATES[key].subject);setMessage(TEMPLATES[key].text);setConfirmed(false);
  }
  async function send(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(sending || !confirmed)return;
    setSending(true);setError("");setNotice("");
    try {
      if (attachment && (attachment.type !== "application/pdf" || attachment.size > 4*1024*1024)) throw new Error("Attach a PDF no larger than 4 MB.");
      let attachmentPayload: {filename:string;content:string}|undefined;
      if(attachment){
        const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");reader.onerror=()=>reject(new Error("Unable to read attachment."));reader.readAsDataURL(attachment);});
        attachmentPayload={filename:attachment.name,content};
      }
      const response=await fetch("/api/dashboard/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from:sender,to,subject,text:message,confirmed:true,attachment:attachmentPayload})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || "Message not sent.");
      setNotice("Email accepted by Resend. Delivery can be checked in Sent.");
      if(draftId)await fetch("/api/dashboard/email/drafts",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:draftId})}).catch(()=>null);
      setDraftId(null);setTo("");setSubject("");setMessage("");setConfirmed(false);setTemplate("blank");setAttachment(null);
      setView("sent");
    }catch(caught){setError(caught instanceof Error?caught.message:"Message not sent.");}
    finally{setSending(false);}
  }
  return <div className={styles.root}>
    <header className={styles.heading}>
      <div><div className={styles.eyebrow}>FLUXKNIGHT · SALES COMMUNICATION</div><h1>Email & Proposals</h1><p>Manage business correspondence and prepare tailored client proposals.</p></div>
      <button type="button" className={styles.primary} onClick={newMessage}>+ Compose</button>
    </header>
    <div className={styles.toolbar}>
      <label>Mailbox <select aria-label="Business mailbox" value={sender} onChange={event=>setSender(event.target.value)}>{SENDERS.map(address=><option key={address} value={address}>{address}</option>)}</select></label>
      <span className={styles.connected}>Resend integration</span>
    </div>
    <nav className={styles.tabs} aria-label="Email folders">
      <button className={view==="inbox"?styles.active:""} onClick={()=>setView("inbox")}>Inbox</button>
      <button className={view==="sent"?styles.active:""} onClick={()=>setView("sent")}>Sent</button>
      <button className={view==="drafts"?styles.active:""} onClick={()=>setView("drafts")}>Drafts</button>
      <button className={view==="compose"?styles.active:""} onClick={newMessage}>New proposal</button>
    </nav>
    {error&&<div className={styles.error} role="alert">{error}</div>}
    {notice&&<div className={styles.success} role="status">{notice}</div>}
    {view==="compose" ? <section className={styles.panel}>
      <form onSubmit={send} className={styles.form}>
        <label>Proposal type<select value={template} onChange={e=>chooseTemplate(e.target.value)}>
          <option value="blank">Custom email</option><option value="hotel">Hotel Automation</option><option value="real-estate">Real Estate Automation</option>
        </select></label>
        <label>From<input value={sender} readOnly /></label>
        <label>To<input type="email" required value={to} onChange={e=>{setTo(e.target.value);setConfirmed(false);}} placeholder="client@company.com" /></label>
        <label>Subject<input required maxLength={200} value={subject} onChange={e=>{setSubject(e.target.value);setConfirmed(false);}} placeholder="Your proposal subject" /></label>
        <label>Message<textarea required rows={14} maxLength={30000} value={message} onChange={e=>{setMessage(e.target.value);setConfirmed(false);}} placeholder="Write a personalized email or choose a template above." /></label>
        <label>Proposal attachment (optional PDF, maximum 4 MB)<input type="file" accept="application/pdf,.pdf" onChange={e=>{setAttachment(e.target.files?.[0]||null);setConfirmed(false);}} /></label>
        <p className={styles.tip}>Replace every bracketed placeholder before sending. Never claim results that have not been verified.</p>
        <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I reviewed the recipient and message, and this contact is eligible to receive this email.</span></label>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={()=>void saveDraft()} disabled={saving}>{saving?"Saving...":draftId?"Update draft":"Save draft"}</button><button className={styles.primary} disabled={sending||!confirmed} type="submit">{sending?"Sending...":"Send email"}</button></div>
      </form>
    </section> : view==="drafts" ? <section className={styles.panel}>
      <div className={styles.panelHeading}><h2>Saved drafts</h2><button onClick={()=>void loadDrafts()} disabled={loading}>Refresh</button></div>
      {loading?<p className={styles.empty}>Loading drafts...</p>:drafts.length===0?<p className={styles.empty}>No saved proposals yet.</p>:<ul className={styles.mailList}>{drafts.map(draft=><li key={draft.id} className={styles.draftRow}>
        <button type="button" onClick={()=>openDraft(draft)}><strong>{draft.recipient||"No recipient yet"}</strong><span>{draft.subject||"Untitled proposal"}</span><small>{draft.sender} · Updated {new Date(draft.updated_at).toLocaleString()}</small></button>
        <button type="button" className={styles.deleteDraft} onClick={()=>void removeDraft(draft.id)} aria-label={"Delete draft: "+(draft.subject||"Untitled")}>Delete</button>
      </li>)}</ul>}
    </section> : <div className={styles.columns}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>{view==="inbox"?"Inbox":"Sent messages"}</h2><button onClick={()=>void load()} disabled={loading}>Refresh</button></div>
        <label className={styles.searchBox}>Search loaded messages<input type="search" placeholder="Search sender, recipient or subject" value={search} onChange={e=>setSearch(e.target.value)} /></label>
        {loading&&rows.length===0?<p className={styles.empty}>Loading messages...</p>:rows.length===0?<p className={styles.empty}>No messages found for this mailbox in the most recent records.</p>:<ul className={styles.mailList}>{rows.filter(mail=>(mail.from+" "+mail.to.join(" ")+" "+mail.subject).toLowerCase().includes(search.toLowerCase())).map(mail=><li key={mail.id}><button className={selected?.id===mail.id?styles.selectedMail:""} onClick={()=>void openMail(mail)}>
          <strong>{view==="inbox"?mail.from:mail.to.join(", ")}</strong><span>{mail.subject}</span><small>{mail.created_at?new Date(mail.created_at).toLocaleString():""} {mail.last_event||""}</small>
        </button></li>)}</ul>}
        {more&&<div className={styles.loadMore}><button type="button" className={styles.secondary} disabled={loading||!cursor} onClick={()=>void load(true)}>{loading?"Loading...":"Load older messages"}</button></div>}
        <p className={styles.tip}>Search covers loaded messages. Use "Load older messages" to extend history.</p>
      </section>
      <section className={styles.panel}>
        {selected?<div className={styles.message}><h2>{selected.subject}</h2><p>From: {selected.from}</p><p>To: {selected.to?.join(", ")}</p><hr/><pre>{selected.text||"This email has no plain-text body. HTML rendering is intentionally disabled for security."}</pre>
          {view==="inbox"&&<button className={styles.secondary} onClick={()=>{setTo(selected.from);setSubject(selected.subject.startsWith("Re:")?selected.subject:"Re: "+selected.subject);setMessage("");setConfirmed(false);setView("compose");}}>Reply</button>}
        </div>:<div className={styles.empty}>Select a message to view its details.</div>}
      </section>
    </div>}
  </div>;
}
