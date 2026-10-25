"use client";
import { useCallback, useEffect, useState } from "react";

type Execution = { id:string; rule_id:string; rule_name:string; scheduled_for:string; status:string; channel:string; attempt_count:number; last_error:string|null; created_at:string };
export default function ReminderExecutionHistory() {
  const [items,setItems]=useState<Execution[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{
    setLoading(true); setError("");
    try {
      const response=await fetch("/api/admin/reminder-rules/executions",{cache:"no-store"});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error||"Unable to load reminder history.");
      setItems(body.executions||[]);
    } catch(e) { setError(e instanceof Error?e.message:"Unable to load reminder history."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ void load(); },[load]);
  return <section style={{border:"1px solid var(--fk-border, #ddd)",borderRadius:16,padding:20,gridColumn:"1 / -1"}}>
    <div style={{display:"flex",gap:12,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
      <div><h2 style={{marginTop:0,marginBottom:4}}>Execution history</h2><p style={{marginTop:0,color:"var(--fk-muted, #777)",fontSize:14}}>Recent reminder evaluations. Blocked external executions have not sent a message.</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading} style={{padding:"8px 12px",border:"1px solid var(--fk-border, #ccc)",borderRadius:8,background:"transparent",color:"inherit",cursor:loading?"wait":"pointer"}}>{loading?"Refreshing…":"Refresh history"}</button>
    </div>
    {error?<p role="alert" style={{color:"#b42318"}}>{error}</p>:null}
    {loading?<p>Loading execution history…</p>:items.length?<div style={{display:"grid",gap:8}}>{items.map(item=><article key={item.id} style={{border:"1px solid var(--fk-border, #ddd)",borderRadius:10,padding:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
      <span><strong>Rule</strong><br/>{item.rule_name}</span><span><strong>Status</strong><br/>{item.status}</span><span><strong>Channel</strong><br/>{item.channel}</span><span><strong>Scheduled</strong><br/>{new Date(item.scheduled_for).toLocaleString()}</span><span><strong>Attempts</strong><br/>{item.attempt_count}</span>
      {item.last_error?<span style={{color:"#b42318"}}><strong>Details</strong><br/>{item.last_error}</span>:null}
    </article>)}</div>:<p>No reminder executions recorded yet.</p>}
  </section>;
}
