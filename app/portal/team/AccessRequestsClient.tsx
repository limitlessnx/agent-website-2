"use client";
import { useEffect, useState } from "react";

type RequestItem={id:string;email:string;status:string;created_at:string};

export default function AccessRequestsClient({accessCode}:{accessCode:string}){
 const [requests,setRequests]=useState<RequestItem[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 async function load(){try{const r=await fetch("/api/portal/team/access-requests");const d=await r.json();if(!r.ok)throw new Error(d.error);setRequests(d.requests||[]);}catch(e){setError(e instanceof Error?e.message:"Unable to load requests.");}finally{setLoading(false);}}
 useEffect(()=>{load()},[]);
 async function act(id:string,action:"approve"|"reject"){setError("");const r=await fetch("/api/portal/team/access-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_id:id,action})});const d=await r.json();if(!r.ok){setError(d.error||"Unable to update request.");return;}await load();}
 return <section className="portal-card">
  <div className="portal-card-head"><div><p className="portal-kicker">Manager access</p><h2>Organization Access ID</h2><p>Share this ID with a manager. It identifies this organization but does not grant access until you approve the request.</p></div><strong>{accessCode}</strong></div>
  <div className="portal-list">{loading?<p className="portal-empty">Loading access requests...</p>:requests.length?requests.map(item=><div className="portal-list-row" key={item.id}><div><strong>{item.email}</strong><span>Requested manager access · {new Date(item.created_at).toLocaleString("en-NG")}</span></div><div className="portal-actions"><button className="portal-button" type="button" onClick={()=>act(item.id,"approve")}>Approve</button><button className="portal-button secondary" type="button" onClick={()=>act(item.id,"reject")}>Reject</button></div></div>):<p className="portal-empty">No pending manager access requests.</p>}{error?<p className="admin-error">{error}</p>:null}</div>
 </section>;
}
