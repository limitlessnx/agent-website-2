"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Organization={organizationId:string;organizationName:string;organizationSlug:string;role:string};

export default function ManagerWorkspaceSwitcher({organizations,currentOrganizationId}:{organizations:Organization[];currentOrganizationId:string}){
 const router=useRouter();
 const [loading,setLoading]=useState("");
 const [open,setOpen]=useState(false);

 async function switchWorkspace(organizationId:string){
  if(organizationId===currentOrganizationId)return;
  setLoading(organizationId);
  try{
   const response=await fetch("/api/client-auth/manager-access",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"enter",organization_id:organizationId}),
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Unable to switch workspace.");
   router.push(data.redirect_to||"/portal");
   router.refresh();
  }catch(error){
   setLoading("");
   window.alert(error instanceof Error?error.message:"Unable to switch workspace.");
  }
 }

 if(organizations.length<=1)return null;

 const current=organizations.find(item=>item.organizationId===currentOrganizationId);

 return <div className="portal-workspace-switcher">
  <button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>
   <span><small>Manager workspace</small><strong>{current?.organizationName||"Current organization"}</strong></span>
   <span aria-hidden="true">⌄</span>
  </button>
  {open?<div className="portal-workspace-switcher-menu" role="menu">
   {organizations.map(item=><button
     key={item.organizationId}
     type="button"
     role="menuitem"
     disabled={Boolean(loading)}
     onClick={()=>switchWorkspace(item.organizationId)}
     className={item.organizationId===currentOrganizationId?"active":""}
   >
    <span><strong>{item.organizationName}</strong><small>{item.role.replaceAll("-"," ")}</small></span>
    {loading===item.organizationId?<span>Switching…</span>:item.organizationId===currentOrganizationId?<span>Current</span>:null}
   </button>)}
  </div>:null}
 </div>;
}
