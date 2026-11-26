"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getIndustryExperience } from "@/lib/industryExperience";
import type { ClientOnboardingProfile, SaveOnboardingInput } from "@/lib/client-workspace-onboarding";

const steps = ["Business profile", "AI requirements", "Business knowledge", "Channels and tools", "Human handover and review"];
const textFields = [
  [["business_name","Business name"],["business_description","Business description"],["website","Website"],["business_email","Business email"],["phone","Business phone"],["country","Country"],["timezone","Time zone"],["staff_size","Team size"]],
  [["ai_requirements","What should your AI handle?"]],
  [],
  [],
  [["human_contact_name","Handover contact"],["human_contact_email","Handover email"],["notes","Additional notes"]],
] as const;
const knowledgeFields = [["services","Products and services"],["faqs","Frequently asked questions"],["pricing","Pricing"],["hours","Opening hours"],["policies","Policies"],["booking","Booking or sales process"],["industry_details","Industry-specific requirements"],["location","Operating location and service areas"]] as const;
const goals = [["answer_questions","Answer customer questions"],["generate_leads","Capture new leads"],["qualify_prospects","Qualify prospects"],["follow_up_leads","Follow up with prospects"],["book_appointments","Book appointments"],["customer_support","Customer support"],["explain_offers","Explain offers"],["send_reminders","Send reminders"],["collect_customer_info","Collect customer information"],["human_handoff","Transfer to my team"]] as const;
const channelOptions = ["WhatsApp","Email","Voice","Website","SMS","Instagram","Facebook"];
type Draft = { texts: Record<string,string>; knowledge: Record<string,string>; whatsapp: ClientOnboardingProfile["whatsapp_preferences"]; business_goals:string[]; channels:string[]; existing_tools:string };
function initial(profile:ClientOnboardingProfile):Draft {
  return { texts:Object.fromEntries(textFields.flatMap(fields=>fields.map(([key])=>[key,profile[key]||""]))), knowledge:{...profile.business_knowledge}, whatsapp:{...profile.whatsapp_preferences}, business_goals:profile.business_goals||[], channels:profile.channels||[], existing_tools:(profile.existing_tools||[]).join("\n") };
}
function sectionPatch(step:number, value:Draft, baseline:Draft):SaveOnboardingInput {
  const patch:Record<string,unknown>={};
  for(const [key] of textFields[step]) if(value.texts[key]!==baseline.texts[key]) patch[key]=value.texts[key];
  if(step===1&&JSON.stringify(value.business_goals)!==JSON.stringify(baseline.business_goals))patch.business_goals=value.business_goals;
  if(step===2){const changes=Object.fromEntries(Object.entries(value.knowledge).filter(([k,v])=>v!==baseline.knowledge[k]));if(Object.keys(changes).length)patch.business_knowledge=changes;}
  if(step===3){
    if(JSON.stringify(value.channels)!==JSON.stringify(baseline.channels))patch.channels=value.channels;
    if(value.existing_tools!==baseline.existing_tools)patch.existing_tools=value.existing_tools.split("\n").map(v=>v.trim()).filter(Boolean);
    const changes=Object.fromEntries(Object.entries(value.whatsapp).filter(([k,v])=>v!==baseline.whatsapp[k as keyof Draft["whatsapp"]]));
    if(Object.keys(changes).length)patch.whatsapp_preferences=changes;
  }
  return patch as SaveOnboardingInput;
}
export default function SetupProgress({profile}:{profile:ClientOnboardingProfile}) {
  const router=useRouter();
  const [step,setStep]=useState(Math.min(4,Math.max(0,(profile.current_step||1)-1)));
  const [draft,setDraft]=useState(()=>initial(profile));
  const [baseline,setBaseline]=useState(()=>initial(profile));
  const [busy,setBusy]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>setHydrated(true),[]);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState("");
  const experience=getIndustryExperience(profile.industry);
  const dirty=Object.keys(sectionPatch(step,draft,baseline)).length>0;
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};const link=(event:MouseEvent)=>{const target=event.target;if(target instanceof Element&&target.closest("a[href]")&&!window.confirm("Leave setup without saving your changes?")){event.preventDefault();event.stopPropagation();}};window.addEventListener("beforeunload",warn);document.addEventListener("click",link,true);return()=>{window.removeEventListener("beforeunload",warn);document.removeEventListener("click",link,true);};},[dirty]);
  function navigate(target:number){if(dirty&&!window.confirm("Discard unsaved changes to this section?"))return;setDraft(baseline);setStep(target);setError("");setSaved("");}
  async function save(mode:"next"|"exit"|"skip"|"submit"){
    if(mode==="skip"&&dirty&&!window.confirm("Skip this section and discard its unsaved changes?"))return;
    setBusy(true);setError("");setSaved("");
    const next=mode==="exit"?step:Math.min(step+1,4);
    try{
      const payload=mode==="skip"?{}:sectionPatch(step,draft,baseline);
      const response=await fetch("/api/client-onboarding",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,current_step:next+1})});
      const result=await response.json();
      if(!response.ok||!result.profile)throw new Error(result.error||"Could not save setup.");
      const updated=initial(result.profile);setBaseline(updated);setDraft(updated);
      if(mode==="submit"){
        const response=await fetch("/api/client-onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"complete"})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||"Could not submit setup.");
        router.push(result.next==="/portal/hotel/setup"?result.next:"/portal");router.refresh();return;
      }
      if(mode==="exit"||step===4){router.push("/portal");router.refresh();}else{setStep(next);setSaved("Progress saved.");}
    }catch(e){setError(e instanceof Error?e.message:"Could not save setup.");}finally{setBusy(false);}
  }
  function toggle(key:"business_goals"|"channels",value:string){setDraft(d=>({...d,[key]:d[key].includes(value)?d[key].filter(v=>v!==value):[...d[key],value]}));}
  const fieldStyle={display:"grid",gap:6,minWidth:0};
  const provided=[textFields[0].some(([key])=>key!=="business_name"&&!!baseline.texts[key]?.trim()),!!baseline.texts.ai_requirements?.trim()||baseline.business_goals.length>0,Object.values(baseline.knowledge).some(v=>!!v.trim()),baseline.channels.some(v=>v!=="WhatsApp")||!!baseline.existing_tools.trim()||!!baseline.whatsapp.preferred_number,!!baseline.texts.human_contact_name?.trim()||!!baseline.texts.human_contact_email?.trim()];
  return <main className="portal-page"><section className="portal-card">
    <h1>Workspace setup</h1><p>Configure your {experience.name} workspace at your own pace. None of these steps are required to access the dashboard.</p>
    <p>Step {step+1} of {steps.length} · {profile.status==="in_progress"?"Setup in progress":"Setup already submitted or configured"}</p>
    <nav aria-label="Setup sections" style={{display:"flex",flexWrap:"wrap",gap:8}}>{steps.map((title,i)=><button key={title} type="button" className="portal-button secondary" aria-current={i===step?"step":undefined} disabled={!hydrated||busy} onClick={()=>navigate(i)}>{i+1}. {title} · {provided[i]?"Saved details":"Optional"}</button>)}</nav>
    <h2>{steps[step]}</h2>
    <fieldset disabled={!hydrated||busy} style={{display:"grid",gap:12,border:0,padding:0,minWidth:0}}>
      {textFields[step].map(([key,label])=><label key={key} htmlFor={`setup-${key}`} style={fieldStyle}>{label}<textarea id={`setup-${key}`} aria-label={label} style={{width:"100%",maxWidth:"100%"}} rows={["business_description","ai_requirements","notes"].includes(key)?4:1} value={draft.texts[key]} onChange={e=>setDraft(d=>({...d,texts:{...d.texts,[key]:e.target.value}}))}/></label>)}
      {step===1&&<><h3>Business goals</h3>{goals.map(([value,label])=><label key={value}><input type="checkbox" checked={draft.business_goals.includes(value)} onChange={()=>toggle("business_goals",value)}/> {label}</label>)}</>}
      {step===2&&<>{experience.workspaceSetupNote&&<p>{experience.workspaceSetupNote}</p>}{knowledgeFields.map(([key,label])=><label key={key} htmlFor={`setup-${key}`} style={fieldStyle}>{label}<textarea id={`setup-${key}`} aria-label={label} style={{width:"100%",maxWidth:"100%"}} rows={4} value={draft.knowledge[key]||""} onChange={e=>setDraft(d=>({...d,knowledge:{...d.knowledge,[key]:e.target.value}}))}/></label>)}</>}
      {step===3&&<><h3>Communication channels</h3>{channelOptions.map(value=><label key={value}><input type="checkbox" checked={draft.channels.includes(value)} onChange={()=>toggle("channels",value)}/> {value}</label>)}<label htmlFor="setup-existing-tools" style={fieldStyle}>Existing business tools (one per line)<textarea id="setup-existing-tools" aria-label="Existing business tools (one per line)" rows={4} value={draft.existing_tools} onChange={e=>setDraft(d=>({...d,existing_tools:e.target.value}))}/></label><label htmlFor="setup-whatsapp-connection" style={fieldStyle}>WhatsApp connection<select id="setup-whatsapp-connection" aria-label="WhatsApp connection" value={draft.whatsapp.connection_path||""} onChange={e=>{const path=e.target.value;if(path==="already_have_whatsapp_business"||path==="need_help")setDraft(d=>({...d,whatsapp:{...d.whatsapp,connection_path:path}}));}}><option value="" disabled>Select an option</option><option value="already_have_whatsapp_business">Use my existing WhatsApp Business number</option><option value="need_help">I need connection assistance</option></select></label><label htmlFor="setup-whatsapp-number" style={fieldStyle}>Preferred WhatsApp number<input id="setup-whatsapp-number" aria-label="Preferred WhatsApp number" value={draft.whatsapp.preferred_number||""} onChange={e=>setDraft(d=>({...d,whatsapp:{...d.whatsapp,preferred_number:e.target.value}}))}/></label><button className="portal-button secondary" type="button" onClick={()=>{if(!dirty||window.confirm("Leave without saving this section?"))router.push("/portal/integrations");}}>Manage integrations</button></>}
      {step===4&&<><p>Save your optional setup or submit your business brief for review. Submission requires the existing business description, AI requirements, goals and knowledge.</p>{profile.status==="in_progress"&&<button className="portal-button secondary" type="button" onClick={()=>save("submit")}>Submit setup for review</button>}</>}
    </fieldset>
    {error&&<p role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}
    <div className="portal-actions" style={{flexWrap:"wrap",gap:8,alignItems:"stretch"}}>
      <button className="portal-button" disabled={!hydrated||busy} onClick={()=>save("next")}>{busy?"Saving…":step===4?"Save & finish for now":"Save & continue"}</button>
      <button className="portal-button secondary" disabled={!hydrated||busy} onClick={()=>save("exit")}>Save & exit</button>
      <button className="portal-button secondary" disabled={!hydrated||busy||step===0} onClick={()=>navigate(step-1)}>Back</button>
      <button className="portal-button secondary" disabled={!hydrated||busy} onClick={()=>save("skip")}>Skip for now</button>
    </div>
    <button className="portal-button secondary" disabled={!hydrated||busy} onClick={()=>{if(!dirty||window.confirm("Leave without saving this section?"))router.push("/portal");}}>Return to dashboard</button>
  </section></main>;
}
