"use client";
import { useRef, useState } from "react";
import GencouvEmailHistory from "@/components/gencouv/GencouvEmailHistory";
import "./gencouv-marketing.css";
import GencouvBulkCampaigns from "@/components/gencouv/GencouvBulkCampaigns";

const templates = {
  blank: {subject:"",text:""},
  copy: {subject:"Gencouv Capital copy trading information",text:"Hello [Name],\n\nThank you for your interest in Gencouv Capital. I am reaching out to share information about our copy trading offering and how onboarding works.\n\nBest regards,\nGencouv Capital"},
  portfolio: {subject:"Gencouv Capital portfolio management enquiry",text:"Hello [Name],\n\nThank you for your interest in Gencouv Capital. I would be happy to share our portfolio management process and discuss whether it fits your objectives.\n\nBest regards,\nGencouv Capital"}
} as const;
export default function GencouvMarketingWorkspace(){
  const [from,setFrom] = useState("info@gencouv.com");
  const [to,setTo] = useState("");
  const [subject,setSubject] = useState("");
  const [message,setMessage] = useState("");
  const [confirmed,setConfirmed] = useState(false);
  const [sending,setSending] = useState(false);
  const requestId=useRef<string|null>(null), submissionLock=useRef(false);
  const [feedback,setFeedback] = useState("");
  const [error,setError] = useState("");
  async function send(){
    if(submissionLock.current)return; submissionLock.current=true; requestId.current ||= crypto.randomUUID();
    setSending(true);setError("");setFeedback("");
    try{
      const response=await fetch("/api/dashboard/gencouv/proposals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_id:requestId.current,from,to,subject,text:message,confirmed})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Email was not sent.");
      setFeedback(data.note||"Email accepted.");
      requestId.current=null;setConfirmed(false);setTo("");setSubject("");setMessage("");
    }catch(e){setError(e instanceof Error?e.message:"Email sending failed.");}
    finally{submissionLock.current=false;setSending(false);}
  }
  return <div className="gencouv-marketing" style={{display:"grid",gap:18,maxWidth:1060,margin:"0 auto"}}>
    <GencouvBulkCampaigns />
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Compose an individual proposal</h2><p>Send a manually reviewed, one-recipient Gencouv email via Resend. This does not start a marketing campaign.</p></div><span className="admin-status">Resend</span></div>
      <div style={{display:"grid",gap:14}}>
        <label className="admin-field">From<select value={from} onChange={e=>{setFrom(e.target.value);setConfirmed(false);requestId.current=null;}}>
          <option value="info@gencouv.com">info@gencouv.com</option><option value="support@gencouv.com">support@gencouv.com</option><option value="onboarding@gencouv.com">onboarding@gencouv.com</option>
        </select></label>
        <label className="admin-field">Proposal template<select defaultValue="blank" onChange={e=>{const key=e.target.value as keyof typeof templates;setSubject(templates[key].subject);setMessage(templates[key].text);setConfirmed(false);requestId.current=null;}}>
          <option value="blank">Custom email</option><option value="copy">Copy trading</option><option value="portfolio">Portfolio management</option>
        </select></label>
        <label className="admin-field">Recipient<input type="email" value={to} maxLength={254} placeholder="client@example.com" onChange={e=>{setTo(e.target.value);setConfirmed(false);requestId.current=null;}}/></label>
        <label className="admin-field">Subject<input value={subject} maxLength={200} onChange={e=>{setSubject(e.target.value);setConfirmed(false);requestId.current=null;}}/></label>
        <label className="admin-field">Message<textarea value={message} rows={10} maxLength={30000} onChange={e=>{setMessage(e.target.value);setConfirmed(false);requestId.current=null;}}/></label>
        <label style={{display:"flex",gap:8,alignItems:"start"}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I have checked the recipient, replaced all placeholders, and reviewed this one-to-one email.</label>
        <button type="button" disabled={sending||!confirmed||!to||!subject.trim()||!message.trim()} onClick={()=>void send()}>{sending?"Sending…":"Send individual email"}</button>
      </div>
      {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}
      {feedback&&<p role="status">{feedback}</p>}
    </section>
    <GencouvEmailHistory />
  </div>;
}
