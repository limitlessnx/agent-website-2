"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Stage={id:string;key:string;name:string;category:string;position:number;is_terminal:boolean;follow_up_default_minutes?:number|null};

export default function CustomerStagesPanel({initialStages,canManage}:{initialStages:Stage[];canManage:boolean}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!canManage) return;
    setBusy(true);setMessage("");
    const form=new FormData(event.currentTarget);
    const payload={
      name:String(form.get("name")||""),
      category:String(form.get("category")||"active"),
      position:Number(form.get("position")||0),
      followUpDefaultMinutes:String(form.get("followUpDefaultMinutes")||"")||null,
      isTerminal:form.get("isTerminal")==="on",
    };
    try{
      const res=await fetch("/api/portal/settings/customer-stages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to create stage");
      event.currentTarget.reset();
      setMessage("Stage saved.");
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to create stage");}
    finally{setBusy(false);}
  }

  async function archive(id:string){
    if(!canManage||!window.confirm("Archive this customer stage? Existing history is preserved.")) return;
    setBusy(true);setMessage("");
    try{
      const res=await fetch("/api/portal/settings/customer-stages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"archive",id}),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to archive stage");
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to archive stage");}
    finally{setBusy(false);}
  }

  return <section className="portal-card">
    <div className="portal-card-head"><div>
      <h2>Customer stages</h2>
      <p>Define the journey your AI and human team use for this organization.</p>
    </div></div>

    <div className="portal-list">
      {initialStages.map((stage)=><div className="portal-list-row" key={stage.id}><div>
        <strong>{stage.name}</strong>
        <span>{stage.category.replaceAll("_"," ")} · position {stage.position}{stage.follow_up_default_minutes ? " · follow-up "+stage.follow_up_default_minutes+" min" : ""}</span>
      </div>{canManage?<button type="button" onClick={()=>void archive(stage.id)} disabled={busy}>Archive</button>:null}</div>)}
    </div>

    {canManage?<form onSubmit={submit} className="portal-form-grid" style={{marginTop:18}}>
      <div className="portal-field"><label>Stage name</label><input name="name" required placeholder="Inspection Booked" /></div>
      <div className="portal-field"><label>Category</label><select name="category" defaultValue="active">
        <option value="active">Active</option>
        <option value="follow_up">Needs follow-up</option>
        <option value="won">Won / completed</option>
        <option value="lost">Lost</option>
        <option value="closed">Closed</option>
      </select></div>
      <div className="portal-field"><label>Position</label><input name="position" type="number" defaultValue="50" /></div>
      <div className="portal-field"><label>Default follow-up minutes</label><input name="followUpDefaultMinutes" type="number" placeholder="1440" /></div>
      <label><input name="isTerminal" type="checkbox" /> Terminal stage</label>
      <div><button type="submit" disabled={busy}>{busy?"Saving...":"Add stage"}</button></div>
    </form>:null}

    {message?<p className="portal-empty">{message}</p>:null}
  </section>;
}
