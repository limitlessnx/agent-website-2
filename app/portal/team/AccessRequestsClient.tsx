"use client";
import { useEffect, useState } from "react";

type RequestItem={id:string;email:string;status:string;created_at:string};
type MemberItem={id:string;user_id:string;email:string|null;status:string;role:string;created_at:string};

export default function AccessRequestsClient({accessCode}:{accessCode:string}){
 const [requests,setRequests]=useState<RequestItem[]>([]);
 const [members,setMembers]=useState<MemberItem[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 async function load(){
  try{
   const r=await fetch("/api/portal/team/access-requests",{cache:"no-store"});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error);
   setRequests(d.requests||[]);
   setMembers(d.members||[]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load team access.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{load()},[]);
 async function act(payload:Record<string,string>,busyKey:string){
  setError("");setBusy(busyKey);
  try{
   const r=await fetch("/api/portal/team/access-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||"Unable to update team access.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to update team access.");}
  finally{setBusy("");}
 }
 async function copyAccessCode(){
  try{await navigator.clipboard.writeText(accessCode);setError("");}
  catch{setError("The Access ID could not be copied. You can copy it manually.");}
 }
 const managers=members.filter(member=>member.role==="manager"&&member.status==="active");
 return <div className="portal-team-access-stack">
  <section className="portal-card">
   <div className="portal-card-head">
    <div><p className="portal-kicker">Manager access</p><h2>Organization Access ID</h2><p>Share this ID with a manager. It identifies this organization but does not grant access until you approve the request.</p></div>
    <div className="portal-actions"><strong>{accessCode}</strong><button className="portal-button secondary" type="button" onClick={copyAccessCode}>Copy Access ID</button></div>
   </div>
  </section>
  <section className="portal-card">
   <div className="portal-card-head"><div><p className="portal-kicker">Pending</p><h2>Manager requests</h2><p>Review people who used this organization’s Access ID.</p></div></div>
   <div className="portal-list">
    {loading?<p className="portal-empty">Loading access requests...</p>:requests.length?requests.map(item=><div className="portal-list-row" key={item.id}>
      <div><strong>{item.email}</strong><span>Requested manager access · {new Date(item.created_at).toLocaleString("en-NG")}</span></div>
      <div className="portal-actions">
       <button className="portal-button" type="button" disabled={busy===item.id} onClick={()=>act({request_id:item.id,action:"approve"},item.id)}>Accept</button>
       <button className="portal-button secondary" type="button" disabled={busy===item.id} onClick={()=>act({request_id:item.id,action:"reject"},item.id)}>Reject</button>
      </div>
    </div>):<p className="portal-empty">No pending manager access requests.</p>}
   </div>
  </section>
  <section className="portal-card">
   <div className="portal-card-head"><div><p className="portal-kicker">Active access</p><h2>Active managers</h2><p>Managers currently authorized to enter this organization. Removing access keeps their account and history but blocks workspace access.</p></div></div>
   <div className="portal-list">
    {managers.length?managers.map(member=><div className="portal-list-row" key={member.id}>
      <div><strong>{member.email||member.user_id}</strong><span>Manager · active · joined {new Date(member.created_at).toLocaleDateString("en-NG")}</span></div>
      <button className="portal-button secondary" type="button" disabled={busy===member.id} onClick={()=>act({membership_id:member.id,action:"remove"},member.id)}>Remove Access</button>
    </div>):<p className="portal-empty">No active managers yet.</p>}
    {error?<p className="admin-error">{error}</p>:null}
   </div>
  </section>
 </div>;
}
