"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Stage={id:string;key:string;name:string;category:string};

export default function CustomerStageControl({customerId,currentStageId,stages,canManage}:{
  customerId:string;currentStageId?:string|null;stages:Stage[];canManage:boolean;
}){
  const router=useRouter();
  const [value,setValue]=useState(currentStageId||"");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function save(next:string){
    setValue(next);
    if(!canManage||!next) return;
    setBusy(true);setError("");
    try{
      const res=await fetch("/api/portal/customers/"+customerId+"/stage",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({stageId:next}),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to update stage");
      router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Unable to update stage");}
    finally{setBusy(false);}
  }

  return <div className="portal-field">
    <label>Customer stage</label>
    <select value={value} disabled={!canManage||busy} onChange={(e)=>void save(e.target.value)}>
      <option value="">No stage set</option>
      {stages.map((stage)=><option key={stage.id} value={stage.id}>{stage.name}</option>)}
    </select>
    {error?<small>{error}</small>:null}
  </div>;
}
