"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2 } from "@/components/admin/ServerIcons";
import { StatusBadge } from "@/components/ui/DashboardPrimitives";
import styles from "../account/choose-mode/AccountModeClient.module.css";
import ClientLogoutButton from "../portal/ClientLogoutButton";

type RequestItem={id:string;organization_id:string;organization_name:string;status:string;created_at:string};
type OrganizationItem={organizationId:string;organizationName:string;role:string};

export default function ManagerOrganizationsClient({email}:{email:string}){
 const router=useRouter();
 const [code,setCode]=useState("");
 const [requests,setRequests]=useState<RequestItem[]>([]);
 const [organizations,setOrganizations]=useState<OrganizationItem[]>([]);
 const [loading,setLoading]=useState(true);
 const [requesting,setRequesting]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [loadError,setLoadError]=useState("");
 const [entering,setEntering]=useState<string|null>(null);

 const load=useCallback((signal?:AbortSignal)=>fetch("/api/client-auth/manager-access",{signal})
  .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load access requests.");return data;})
  .then(data=>{if(!signal?.aborted){setLoadError("");setRequests(data.requests||[]);setOrganizations(data.organizations||[]);}})
  .catch(error=>{if(!signal?.aborted)setLoadError(error instanceof Error?error.message:"Unable to load access requests.");})
  .finally(()=>{if(!signal?.aborted)setLoading(false);}),[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
 function refresh(){setLoading(true);setLoadError("");void load();}

 async function enterOrganization(organizationId:string){
  setError("");
  setEntering(organizationId);
  try{
    const r=await fetch("/api/client-auth/manager-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"enter",organization_id:organizationId})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to enter workspace.");
    router.push(d.redirect_to||"/portal");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to enter workspace.");}
  finally{setEntering(null);}
 }
 async function requestAccess(){
  setRequesting(true);setMessage("");setError("");
  try{
   const r=await fetch("/api/client-auth/manager-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({access_code:code})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to request access.");
   setCode("");setMessage(d.message||"Access request sent. The organization owner must approve it before you can enter.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to request access.");}
  finally{setRequesting(false);}
 }

 return <main className="admin-login-page">
  <section className={`admin-login-card ${styles.managerCard}`}>
   <p className="admin-kicker">Manager account</p>
   <h1>Manage Organizations</h1>
   <p className="admin-muted">Signed in as {email}. Ask the organization owner for the Access ID shown in their Team settings. Enter it below, then wait for owner approval.</p>
   <form className={styles.options} onSubmit={event=>{event.preventDefault();void requestAccess();}}>
    <label>Organization Access ID<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="FLX-XXXXXXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} required pattern="FLX-[A-Z0-9]{8}" aria-describedby="manager-access-hint"/></label>
    <p id="manager-access-hint" className="admin-muted">An Access ID requests membership. It does not grant workspace access by itself.</p>
    <button type="submit" disabled={requesting||!code.trim()} aria-busy={requesting}>{requesting?"Sending request...":"Request Access"}</button>
   </form>
   {message?<p className="admin-form-message" role="status">{message}</p>:null}
   {error?<p className="admin-error" role="alert">{error}</p>:null}
   <h2>Your organizations</h2>
   {loading?<p className="admin-muted" role="status">Loading organization access...</p>:loadError?<div role="alert"><p className="admin-error">{loadError}</p><button type="button" onClick={refresh}>Retry loading access</button><Link href="/account/login">Sign in again</Link></div>:<>
    {organizations.length?<div className={styles.options}>{organizations.map(item=><button key={item.organizationId} className={styles.choiceCard} type="button" onClick={()=>void enterOrganization(item.organizationId)} disabled={Boolean(entering)} aria-busy={entering===item.organizationId}><span className={styles.choiceIcon} aria-hidden="true"><Building2 size={20}/></span><span className={styles.choiceCopy}><span className={styles.choiceTitle}>{item.organizationName}</span><span className={styles.choiceDescription}>{entering===item.organizationId?"Opening workspace...":"Enter Workspace"}</span></span><ArrowRight size={18} aria-hidden="true"/></button>)}</div>:<p className="admin-muted">No approved organizations yet. Use an Access ID to request membership.</p>}
   <h2>Access requests</h2>
   <button type="button" onClick={refresh}>Refresh access</button>
   {requests.length?<ul className={styles.requestList}>{requests.map(item=><li key={item.id} className={styles.requestItem}><strong>{item.organization_name}</strong><StatusBadge tone={item.status==="pending"?"warning":item.status==="approved"?"success":"neutral"}>{item.status==="approved"&&!organizations.some(org=>org.organizationId===item.organization_id)?"Previously approved — no active access":item.status}</StatusBadge></li>)}</ul>:<p className="admin-muted">No organization access requests yet.</p>}
   </>}
   <ClientLogoutButton/>
  </section>
 </main>;
}
