"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./EmailWorkspace.module.css";

type Mail = {id:string;from:string;to:string[];subject:string;created_at:string;text?:string;html?:string;last_event?:string};
type View = "inbox" | "sent" | "compose";
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
  const [more,setMore] = useState(false);
  const [template,setTemplate] = useState("blank");
  const load = useCallback(async () => {
    setLoading(true);setError("");setSelected(null);
    try {
      const response = await fetch("/api/dashboard/email?kind="+view+"&sender="+encodeURIComponent(sender),{cache:"no-store"});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Unable to load messages.");
      setRows(data.emails || []);setMore(Boolean(data.has_more));
    } catch (caught) {setError(caught instanceof Error ? caught.message : "Unable to load mail.");}
    finally {setLoading(false);}
  },[view,sender]);
  useEffect(()=>{if(view!=="compose")void load();},[view,load]);
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
      const response=await fetch("/api/dashboard/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from:sender,to,subject,text:message,confirmed:true})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || "Message not sent.");
      setNotice("Email accepted by Resend. Delivery can be checked in Sent.");
      setTo("");setSubject("");setMessage("");setConfirmed(false);setTemplate("blank");
      setView("sent");
    }catch(caught){setError(caught instanceof Error?caught.message:"Message not sent.");}
    finally{setSending(false);}
  }
  return <div className={styles.root}>
    <header className={styles.heading}>
      <div><div className={styles.eyebrow}>FLUXKNIGHT · SALES COMMUNICATION</div><h1>Email & Proposals</h1><p>Manage business correspondence and prepare tailored client proposals.</p></div>
      <button type="button" className={styles.primary} onClick={()=>{setView("compose");setSelected(null);setError("");}}>+ Compose</button>
    </header>
    <div className={styles.toolbar}>
      <label>Mailbox <select aria-label="Business mailbox" value={sender} onChange={event=>setSender(event.target.value)}>{SENDERS.map(address=><option key={address} value={address}>{address}</option>)}</select></label>
      <span className={styles.connected}>Resend integration</span>
    </div>
    <nav className={styles.tabs} aria-label="Email folders">
      <button className={view==="inbox"?styles.active:""} onClick={()=>setView("inbox")}>Inbox</button>
      <button className={view==="sent"?styles.active:""} onClick={()=>setView("sent")}>Sent</button>
      <button className={view==="compose"?styles.active:""} onClick={()=>setView("compose")}>New proposal</button>
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
        <p className={styles.tip}>Replace every bracketed placeholder before sending. Never claim results that have not been verified. This first release sends plain-text proposals without attachments.</p>
        <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I reviewed the recipient and message, and this contact is eligible to receive this email.</span></label>
        <button className={styles.primary} disabled={sending||!confirmed} type="submit">{sending?"Sending...":"Send email"}</button>
      </form>
    </section> : <div className={styles.columns}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>{view==="inbox"?"Inbox":"Sent messages"}</h2><button onClick={()=>void load()} disabled={loading}>Refresh</button></div>
        {loading?<p className={styles.empty}>Loading messages...</p>:rows.length===0?<p className={styles.empty}>No messages found for this mailbox in the most recent records.</p>:<ul className={styles.mailList}>{rows.map(mail=><li key={mail.id}><button className={selected?.id===mail.id?styles.selectedMail:""} onClick={()=>void openMail(mail)}>
          <strong>{view==="inbox"?mail.from:mail.to.join(", ")}</strong><span>{mail.subject}</span><small>{mail.created_at?new Date(mail.created_at).toLocaleString():""} {mail.last_event||""}</small>
        </button></li>)}</ul>}
        {more&&<p className={styles.tip}>More account history exists. Pagination and full-text search are planned for the next release.</p>}
      </section>
      <section className={styles.panel}>
        {selected?<div className={styles.message}><h2>{selected.subject}</h2><p>From: {selected.from}</p><p>To: {selected.to?.join(", ")}</p><hr/><pre>{selected.text||"This email has no plain-text body. HTML rendering is intentionally disabled for security."}</pre>
          {view==="inbox"&&<button className={styles.secondary} onClick={()=>{setTo(selected.from);setSubject(selected.subject.startsWith("Re:")?selected.subject:"Re: "+selected.subject);setMessage("");setConfirmed(false);setView("compose");}}>Reply</button>}
        </div>:<div className={styles.empty}>Select a message to view its details.</div>}
      </section>
    </div>}
  </div>;
}
