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
  const [pending,setPending]=useState(false);
  const requestId=useRef<string|null>(null), submissionLock=useRef(false);
  const [feedback,setFeedback] = useState("");
  const [error,setError] = useState("");
  async function send(){
    if(submissionLock.current)return; submissionLock.current=true; requestId.current ||= crypto.randomUUID();
    setSending(true);setError("");setFeedback("");
    let validationFailure=false;
    try{
      const response=await fetch("/api/dashboard/gencouv/proposals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_id:requestId.current,from,to,subject,text:message,confirmed:pending?true:confirmed})});
      const data=await response.json();
      if(!response.ok){validationFailure=response.status===400;throw new Error(data.error||"Submission was not confirmed. Check the same request before editing.");}
      setFeedback(data.note||"Provider outcome recorded. Review delivery history.");
      if(data.status==="submitted"&&data.accepted===1){setPending(false);requestId.current=null;setConfirmed(false);setTo("");setSubject("");setMessage("");}
      else if(["failed","cancelled"].includes(data.status)){setFeedback("");setPending(false);requestId.current=null;setConfirmed(false);setError(data.note||"The provider did not accept this email. Review before a new attempt.");}
      else setPending(true);
    }catch(e){setPending(pending||!validationFailure);setError(e instanceof Error?e.message:"Submission is uncertain. Check this same saved request; do not create a duplicate.");}
    finally{submissionLock.current=false;setSending(false);}
  }
  return <div className="gencouv-marketing" style={{display:"grid",gap:18,maxWidth:1060,margin:"0 auto"}}>
    <GencouvBulkCampaigns />
    <section id="gencouv-proposal" className="admin-panel">
      <div className="admin-panel-header"><div><h2>Compose an individual proposal</h2><p>Send a manually reviewed, one-recipient Gencouv email via Resend. This does not start a marketing campaign.</p></div><span className="admin-status">Resend</span></div>
      <div style={{display:"grid",gap:14}}>
        <label className="admin-field">From<select disabled={sending||pending} value={from} onChange={e=>{setFrom(e.target.value);setConfirmed(false);requestId.current=null;}}>
          <option value="info@gencouv.com">info@gencouv.com</option><option value="support@gencouv.com">support@gencouv.com</option><option value="onboarding@gencouv.com">onboarding@gencouv.com</option>
        </select></label>
        <label className="admin-field">Proposal template<select disabled={sending||pending} defaultValue="blank" onChange={e=>{const key=e.target.value as keyof typeof templates;setSubject(templates[key].subject);setMessage(templates[key].text);setConfirmed(false);requestId.current=null;}}>
          <option value="blank">Custom email</option><option value="copy">Copy trading</option><option value="portfolio">Portfolio management</option>
        </select></label>
        <label className="admin-field">Recipient<input disabled={sending||pending} type="email" value={to} maxLength={254} placeholder="client@example.com" onChange={e=>{setTo(e.target.value);setConfirmed(false);requestId.current=null;}}/></label>
        <label className="admin-field">Subject<input disabled={sending||pending} value={subject} maxLength={200} onChange={e=>{setSubject(e.target.value);setConfirmed(false);requestId.current=null;}}/></label>
        <label className="admin-field">Message<textarea aria-label="Individual email message" disabled={sending||pending} value={message} rows={10} maxLength={30000} onChange={e=>{setMessage(e.target.value);setConfirmed(false);requestId.current=null;}}/></label>
        <label style={{display:"flex",gap:8,alignItems:"start"}}><input disabled={sending||pending} type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I have checked the recipient, replaced all placeholders, and reviewed this one-to-one email.</label>
        <button className="gencouv-primary" type="button" disabled={sending||(!pending&&(!confirmed||!to||!subject.trim()||!message.trim()))} onClick={()=>void send()}>{sending?"Checking submission…":pending?"Check saved email result":"Send individual email"}</button>
      </div>
      {pending?<p role="status">This draft is held until its outcome is confirmed. Check its saved result or refresh outcomes in Email history; no uncertain email is resent.</p>:null}
      {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}
      {feedback&&<p role="status">{feedback}</p>}
    </section>
    <GencouvEmailHistory />
  </div>;
}
