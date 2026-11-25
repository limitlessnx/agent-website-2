"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClientOnboardingProfile } from "@/lib/client-workspace-onboarding";

const steps = [
  {title:"Business profile",fields:[["business_description","What does your business do?"],["website","Website"],["phone","Business phone"],["country","Country"],["timezone","Time zone"]]},
  {title:"AI requirements",fields:[["ai_requirements","What should your AI handle?"]]},
  {title:"Human handoff",fields:[["human_contact_name","Contact name"],["human_contact_email","Contact email"]]},
] as const;

export default function SetupProgress({profile}:{profile:ClientOnboardingProfile}) {
  const router=useRouter();
  const [step,setStep]=useState(Math.min(2,Math.max(0,profile.current_step-1)));
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(steps.flatMap(s=>s.fields.map(([key])=>[key,profile[key]||""]))));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState("");
  async function save(exit:boolean,skip=false) {
    setBusy(true);setError("");setSaved("");
    try {
      const payload=skip?{}:Object.fromEntries(steps[step].fields.map(([key])=>[key,values[key]]));
      const next=exit&&!skip?step:Math.min(step+1,2);
      const response=await fetch("/api/client-onboarding",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,current_step:next+1})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not save setup.");
      if(exit){router.push("/portal");router.refresh();}else{setStep(next);setSaved("Progress saved.");}
    }catch(e){setError(e instanceof Error?e.message:"Could not save setup.");}finally{setBusy(false);}
  }
  return <main className="portal-page"><section className="portal-card"><h1>Complete your workspace</h1><p>All remaining steps are optional for dashboard access.</p><p>Step {step+1} of {steps.length}</p><h2>{steps[step].title}</h2><div style={{display:"grid",gap:12}}>{steps[step].fields.map(([key,label])=><label key={key} style={{display:"grid",gap:6}}>{label}<textarea rows={key==="business_description"||key==="ai_requirements"?4:1} value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} disabled={busy}/></label>)}</div>{error&&<p role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}<div className="portal-actions" style={{flexWrap:"wrap",gap:8}}><button className="portal-button" disabled={busy} onClick={()=>save(false)}>{busy?"Saving…":"Save & continue"}</button><button className="portal-button secondary" disabled={busy} onClick={()=>save(true)}>Save & exit</button><button className="portal-button secondary" disabled={busy||step===0} onClick={()=>setStep(s=>s-1)}>Back</button><button className="portal-button secondary" disabled={busy} onClick={()=>save(step===2,true)}>Skip for now</button></div><p><Link href="/portal/integrations">Connect communication channels</Link></p><p><Link href="/portal">Return to dashboard</Link></p></section></main>;
}
