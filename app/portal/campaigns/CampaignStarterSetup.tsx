"use client";
import { useState } from "react";
import { campaignStarters } from "@/lib/campaign-starter-templates";

const labels: Record<string,string> = {
  ready:"Approved and mapped", existing_mapping_preserved:"Existing mapping preserved",
  submitted_for_review:"Submitted to Meta for review", pending:"Awaiting Meta approval",
  not_submitted:"Not submitted", contract_mismatch:"Existing provider template does not match the saved contract",
  mapping_conflict_refresh:"Mapping changed; refresh approval status", mapping_failed:"Unable to save mapping",
  submission_unknown_refresh:"Submission unconfirmed; check approval before retrying",
  provider_rejected_refresh:"Meta rejected the request; check the account and template status",
};

export default function CampaignStarterSetup({hotel}: {hotel:boolean}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [results,setResults]=useState<Array<{name:string;status:string}>>([]);
  async function prepare(action:"submit"|"link") {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/portal/campaigns/starter-templates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to prepare templates.");
      setResults(data.results||[]);
    } catch(reason){setError(reason instanceof Error?reason.message:"Unable to prepare templates.");}
    finally{setBusy(false);}
  }
  return <section className="exposure-panel" aria-label="Starter campaign templates">
    <h2>Starter campaign templates</h2>
    <p>Use Fluxknight's standard templates with your own WhatsApp business account. Meta approval is required before sending.</p>
    <ul>{campaignStarters(hotel).map(item=><li key={item.name}><strong>{item.name.replaceAll("_"," ")}</strong> · {labels[results.find(row=>row.name===item.name)?.status||""]||results.find(row=>row.name===item.name)?.status||"Saved starter definition"}</li>)}</ul>
    <button className="portal-button" type="button" disabled={busy} onClick={()=>void prepare("submit")}>Submit missing starter templates</button>{" "}
    <button className="portal-button secondary" type="button" disabled={busy} onClick={()=>void prepare("link")}>Check approval and link</button>
    {results.some(row=>row.status==="ready")&&<p><a href="/portal/campaigns">Reload campaign dashboard</a> to use approved templates.</p>}
    {busy&&<p role="status">Checking your WhatsApp account…</p>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
