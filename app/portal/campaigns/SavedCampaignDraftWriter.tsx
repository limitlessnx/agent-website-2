"use client";
import {useEffect,useState} from "react";
import CampaignAiWriter from "@/components/CampaignAiWriter";
import type {SavedCampaignDraft} from "@/lib/campaign-draft-contracts";
const key=(item:SavedCampaignDraft)=>item.name+":"+item.language;
export default function SavedCampaignDraftWriter(){
  const [drafts,setDrafts]=useState<SavedCampaignDraft[]>([]);
  const [selection,setSelection]=useState("");
  const [values,setValues]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/portal/campaigns/writeup",{cache:"no-store",signal:controller.signal}).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw Error(data.error||"Unable to load saved drafts.");
      if(controller.signal.aborted)return;
      setDrafts(data.drafts||[]);setSelection(data.drafts?.[0]?key(data.drafts[0]):"");
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason.message||"Unable to load saved drafts.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[]);
  const selected=drafts.find(item=>key(item)===selection);
  return <section className="exposure-panel" aria-label="Offline campaign drafting">
    <h3>Prepare a campaign draft</h3>
    <p>Write with AI using saved template fields even when WhatsApp is not connected or Meta inventory is unavailable. This editor cannot send campaigns.</p>
    {loading&&<p role="status">Loading saved mappings…</p>}
    {error&&<p role="alert">{error}</p>}
    {!loading&&!error&&!selected&&<p>No supported saved draft fields are available.</p>}
    {selected&&<>
      <label>Saved template<select value={selection} onChange={event=>{setSelection(event.target.value);setValues({});}}>{drafts.map(item=><option key={key(item)} value={key(item)}>{item.name.replaceAll("_"," ")} · {item.language}</option>)}</select></label>
      <p>{selected.wordingVerified?"Saved starter wording; live approval unverified.":"Field-only guide; exact Meta wording is not available."}</p>
      <CampaignAiWriter key={selection} endpoint="/api/portal/campaigns/writeup" context={{templateName:selected.name,language:selected.language,draftOnly:"true"}} values={values} onApply={setValues}/>
      {Object.keys(values).length>0&&<div><h4>Draft field values</h4>{Object.entries(values).map(([name,value])=><label key={name}>{name.replaceAll("_"," ")}<textarea value={value} readOnly rows={3} style={{width:"100%"}}/></label>)}<p>Copy these values into the verified campaign editor when Meta access is restored. Nothing has been sent.</p></div>}
    </>}
  </section>;
}
