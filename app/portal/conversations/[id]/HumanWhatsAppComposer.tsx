"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function HumanWhatsAppComposer({conversationId,canReply}:{conversationId:string;canReply:boolean}){
  const router=useRouter();
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  async function submit(event:FormEvent){
    event.preventDefault();
    if(!canReply||!message.trim()) return;
    setBusy(true);setStatus("");
    try{
      const res=await fetch("/api/portal/conversations/"+conversationId+"/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message}),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to send message");
      setMessage("");
      setStatus("Sent as human. AI remains paused until handoff resolution.");
      router.refresh();
    }catch(err){setStatus(err instanceof Error?err.message:"Unable to send message");}
    finally{setBusy(false);}
  }

  if(!canReply) return null;
  return <form onSubmit={submit} className="portal-card">
    <div className="portal-card-head"><div>
      <h2>Reply as human</h2>
      <p>Messages send from this tenant's WhatsApp number. Sending takes human control of this conversation.</p>
    </div></div>
    <div className="portal-field">
      <label>Message</label>
      <textarea value={message} onChange={(e)=>setMessage(e.target.value)} rows={4} placeholder="Type your reply..." disabled={busy} />
    </div>
    <div style={{display:"flex",gap:10,alignItems:"center",marginTop:12}}>
      <button type="submit" disabled={busy||!message.trim()}>{busy?"Sending...":"Send on WhatsApp"}</button>
      {status?<small>{status}</small>:null}
    </div>
  </form>;
}
