"use client";

import {useActionState,useState} from "react";
import {generateRealtySocialDraftsAction} from "@/app/dashboard/social/real-estate-actions";
import {ReviewSubmitButton} from "@/app/dashboard/social/review/ReviewSubmitButton";

export default function RealtySocialDraftForm({mode,requestId}:{mode:"research"|"idea";requestId:string}) {
  const [state,submit,pending]=useActionState(generateRealtySocialDraftsAction,{error:null});
  const [idea,setIdea]=useState("");
  return <form action={submit} style={{display:"grid",gap:14}}>
    <input type="hidden" name="mode" value={mode}/><input type="hidden" name="request_id" value={requestId}/>
    {mode==="idea"?<><label htmlFor="realty-post-idea">Post idea or brief</label><textarea id="realty-post-idea" name="idea" value={idea} onChange={e=>setIdea(e.target.value)} disabled={pending} required maxLength={4000} rows={6} placeholder="Explain the questions buyers should ask before inspecting land in Benin City…" style={{width:"100%",minWidth:0,padding:12,borderRadius:12,background:"var(--fk-surface)",color:"inherit",border:"1px solid var(--fk-border)",resize:"vertical"}}/><small>Your brief is saved with the draft. Property prices, availability and legal claims still need verification.</small></>:null}
    {state.error?<p role="alert" style={{overflowWrap:"anywhere"}}>{state.error}</p>:null}
    <ReviewSubmitButton kind="primary" disabled={pending} pendingLabel={mode==="research"?"Researching and drafting…":"Preparing draft…"}>{mode==="research"?"Research topics and draft posts":"Generate a draft from my idea"}</ReviewSubmitButton>
  </form>;
}
