"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RequestItem={id:string;organization_id:string;organization_name:string;status:string;created_at:string};

export default function ManagerOrganizationsClient({email}:{email:string}){
 const router=useRouter();
 const [code,setCode]=useState("");
 const [requests,setRequests]=useState<RequestItem[]>([]);
 const [loading,setLoading]=useState(true);
 const [requesting,setRequesting]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");

 async function load(){
  setLoading(true);
  try{const r=await fetch("/api/client-auth/manager-access");const d=await r.json();if(!r.ok)throw new Error(d.error);setRequests(d.requests||[]);}
  catch(e){setError(e instanceof Error?e.message:"Unable to load access requests.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{load()},[]);

 async function requestAccess(){
  setRequesting(true);setMessage("");setError("");
  try{
   const r=await fetch("/api/client-auth/manager-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({access_code:code})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to request access.");
   setCode("");setMessage("Access request sent. The organization administrator must approve it.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to request access.");}
  finally{setRequesting(false);}
 }

 return <main className="admin-login-page">
  <section className="admin-login-card">
   <p className="admin-kicker">Manager account</p>
   <h1>Manage Organizations</h1>
   <p className="admin-muted">Signed in as {email}. Enter an Organization Access ID to request access. Approval is required before you can enter the workspace.</p>
   <label>Organization Access ID<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="FLX-XXXXXXXX" autoComplete="off"/></label>
   <button type="button" onClick={requestAccess} disabled={requesting||!code.trim()}>{requesting?"Sending request...":"Request Access"}</button>
   {message?<p className="admin-form-message">{message}</p>:null}
   {error?<p className="admin-error">{error}</p>:null}
   <h2>Access requests</h2>
   {loading?<p className="admin-muted">Loading...</p>:requests.length?<div>{requests.map(item=><div key={item.id}><strong>{item.organization_name}</strong><span>{item.status}</span></div>)}</div>:<p className="admin-muted">No organization access requests yet.</p>}
  </section>
 </main>;
}
